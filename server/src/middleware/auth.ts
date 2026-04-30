import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        displayName: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  req.user = payload;
  next();
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  // TODO: Check LeagueMembership role for the current league context
  // For now, require auth and pass through
  // This should be called after requireAuth
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}
