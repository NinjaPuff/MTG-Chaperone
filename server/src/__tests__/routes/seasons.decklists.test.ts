import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  listVisibleDecklistsForSeason: vi.fn(),
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
    requireAuth: (req: any, res: any, next: any) => {
      const testUserId = req.headers['x-test-user'];
      if (typeof testUserId !== 'string' || testUserId.length === 0) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }
      req.user = {
        id: testUserId,
        displayName: 'Test User',
        slug: 'test-user',
        avatarUrl: null,
        role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'user',
      };
      next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../services/decklistService.js', () => ({
  listVisibleDecklistsForSeason: mocks.listVisibleDecklistsForSeason,
}));

import app from '../../index.js';

describe('season decklists route', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.listVisibleDecklistsForSeason.mockReset();
  });

  it('returns visible decklists for anonymous viewers when season visibility is on', async () => {
    prismaMock.season.findUnique.mockResolvedValue({
      id: 'season-1',
      decklistVisibility: true,
    });
    mocks.listVisibleDecklistsForSeason.mockResolvedValue([
      { id: 'deck-1', status: 'submitted' },
    ]);

    const response = await request(app).get('/api/seasons/season-1/decklists');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta).toEqual({ decklistVisibility: true });
    expect(mocks.listVisibleDecklistsForSeason).toHaveBeenCalledWith('season-1', null);
  });

  it('returns empty data with meta when visibility is off for anonymous viewers', async () => {
    prismaMock.season.findUnique.mockResolvedValue({
      id: 'season-hidden',
      decklistVisibility: false,
    });
    mocks.listVisibleDecklistsForSeason.mockResolvedValue([]);

    const response = await request(app).get('/api/seasons/season-hidden/decklists');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toEqual({ decklistVisibility: false });
  });

  it('passes viewer to service when authenticated', async () => {
    prismaMock.season.findUnique.mockResolvedValue({
      id: 'season-hidden',
      decklistVisibility: false,
    });
    mocks.listVisibleDecklistsForSeason.mockResolvedValue([{ id: 'deck-draft', status: 'draft' }]);

    const response = await request(app)
      .get('/api/seasons/season-hidden/decklists')
      .set('x-test-user', 'user-alice');

    expect(response.status).toBe(200);
    expect(mocks.listVisibleDecklistsForSeason).toHaveBeenCalledWith('season-hidden', {
      id: 'user-alice',
      role: 'user',
    });
    expect(response.body.data).toHaveLength(1);
  });
});
