import type { Request, Response, NextFunction } from 'express';

type TestUser = {
  id: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  role: 'admin' | 'user';
};

export function mockOptionalAuth(req: Request, _res: Response, next: NextFunction) {
  const testUserId = req.headers['x-test-user'];
  if (typeof testUserId === 'string' && testUserId.length > 0) {
    req.user = {
      id: testUserId,
      displayName: 'Test User',
      slug: 'test-user',
      avatarUrl: null,
      role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'user',
    } satisfies TestUser;
  }
  next();
}

export function mockRequireAuth(req: Request, res: Response, next: NextFunction) {
  const testUserId = req.headers['x-test-user'];
  if (typeof testUserId !== 'string' || testUserId.length === 0) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }
  req.user = {
    id: testUserId,
    displayName: 'Test User',
    slug: 'test-user',
    avatarUrl: null,
    role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'user',
  } satisfies TestUser;
  next();
}

export function mockRequireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    next(Object.assign(new Error('Admin access required'), { status: 403 }));
    return;
  }
  next();
}
