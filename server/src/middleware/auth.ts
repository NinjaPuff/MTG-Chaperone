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
      role: 'admin' | 'user';
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
        publicName: true,
        slug: true,
        avatarUrl: true,
        role: true,
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

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }

  if (req.user.role !== 'admin') {
    next(new AppError(403, 'FORBIDDEN', 'Admin access required'));
    return;
  }

  next();
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
        publicName: true,
        slug: true,
        avatarUrl: true,
        role: true,
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
