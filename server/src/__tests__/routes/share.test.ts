import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  getDecklistById: vi.fn(),
  getDecklistShare: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../middleware/auth.js', async () => {
  const { mockOptionalAuth } = await import('../helpers/mockOptionalAuth.js');
  return {
    optionalAuth: mockOptionalAuth,
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = {
        id: req.headers['x-test-user'] ?? 'user-1',
        displayName: 'Test User',
        slug: 'test-user',
        avatarUrl: null,
        role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'user',
      };
      next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
    getAuthUser: (req: any) => req.user,
  };
});

vi.mock('../../services/decklistService.js', () => ({
  getDecklistById: mocks.getDecklistById,
}));

vi.mock('../../services/decklistShareService.js', () => ({
  getDecklistShare: mocks.getDecklistShare,
  createDecklistShare: vi.fn(),
}));

import app from '../../index.js';

const snapshot = {
  v: 1,
  ownerDisplayName: 'Alice',
  deckName: 'Deck 1',
  eventName: 'Week 1',
  roundNumber: 1,
  status: 'draft',
  entries: [],
};

describe('share decklist routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.getDecklistById.mockReset();
    mocks.getDecklistShare.mockReset();
  });

  it('returns a stored snapshot for guests without calling getDecklistById', async () => {
    mocks.getDecklistShare.mockResolvedValue(snapshot);

    const response = await request(app).get('/api/share/decklists/tok_test');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(snapshot);
    expect(mocks.getDecklistShare).toHaveBeenCalledWith('tok_test');
    expect(mocks.getDecklistById).not.toHaveBeenCalled();
  });

  it('returns 404 INVALID_SHARE for a missing token and does not 200 a live deck UUID', async () => {
    mocks.getDecklistShare.mockRejectedValue(new AppError(404, 'INVALID_SHARE', 'Share link is invalid'));

    const response = await request(app).get(
      '/api/share/decklists/11111111-1111-4111-8111-111111111111',
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('INVALID_SHARE');
    expect(mocks.getDecklistById).not.toHaveBeenCalled();
  });
});
