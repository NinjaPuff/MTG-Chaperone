import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      displayName: string;
      slug: string;
      avatarUrl: string | null;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        displayName: true,
        slug: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User account no longer exists' },
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(leagueSlugParam: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    const leagueSlug = req.params[leagueSlugParam];
    if (!leagueSlug) {
      next(new AppError(400, 'VALIDATION_ERROR', 'League slug is required'));
      return;
    }

    try {
      const membership = await prisma.leagueMembership.findFirst({
        where: {
          userId: req.user.id,
          league: { slug: leagueSlug },
        },
        select: { role: true },
      });

      if (!membership || membership.role !== 'admin') {
        next(new AppError(403, 'FORBIDDEN', 'Admin access required'));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        displayName: true,
        slug: true,
        avatarUrl: true,
      },
    });

    if (user) {
      req.user = user;
    }
  } catch {
    // Best-effort auth; requests should continue without a user.
  }

  next();
}
