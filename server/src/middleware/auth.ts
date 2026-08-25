import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { verifyToken } from '../config/jwt.js';
import type { PrismaClient } from '@prisma/client';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      displayName: string;
      publicName?: string | null;
      slug: string;
      avatarUrl: string | null;
      role: 'admin' | 'user';
    }
  }
}

export function getAuthUser(req: Request): Express.User {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  return req.user;
}

export function createAuthMiddleware(deps: {
  jwt: { verifyToken: (token: string) => { userId: string; displayName: string } | null };
  prisma: PrismaClient;
}) {
  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const token = authHeader.slice(7);
    const payload = deps.jwt.verifyToken(token);
    if (!payload) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
      return;
    }

    try {
      const user = await deps.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          ...USER_PUBLIC_SELECT,
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

  function requireAdmin(req: Request, _res: Response, next: NextFunction) {
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

  async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    try {
      const token = authHeader.slice(7);
      const payload = deps.jwt.verifyToken(token);
      if (!payload) {
        next();
        return;
      }

      const user = await deps.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          ...USER_PUBLIC_SELECT,
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

  return { requireAuth, requireAdmin, optionalAuth };
}

const defaultMiddleware = createAuthMiddleware({
  jwt: { verifyToken },
  prisma,
});

export const requireAuth = defaultMiddleware.requireAuth;
export const requireAdmin = defaultMiddleware.requireAdmin;
export const optionalAuth = defaultMiddleware.optionalAuth;
