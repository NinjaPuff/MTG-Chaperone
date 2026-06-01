import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { spectatorFixtures } from '../helpers/spectatorFixtures.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  listPoolsBySeason: vi.fn(),
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

vi.mock('../../services/cardPoolService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/cardPoolService.js')>();
  return {
    ...actual,
    listPoolsBySeason: mocks.listPoolsBySeason,
  };
});

import app from '../../index.js';

describe('leagues pool list routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.listPoolsBySeason.mockReset();
    prismaMock.league.findUnique.mockResolvedValue({ id: spectatorFixtures.league.id });
  });

  it('returns all pools when visibility is on for anonymous viewers', async () => {
    prismaMock.season.findFirst.mockResolvedValue(spectatorFixtures.seasons.visible);
    mocks.listPoolsBySeason.mockResolvedValue([
      { id: 'pool-alice', userId: 'user-alice', user: spectatorFixtures.users.alice },
      { id: 'pool-bob', userId: 'user-bob', user: spectatorFixtures.users.bob },
    ]);

    const response = await request(app).get('/api/leagues/test-league/seasons/1/pools');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual({ poolVisibility: true });
  });

  it('returns empty data when visibility is off for anonymous viewers', async () => {
    prismaMock.season.findFirst.mockResolvedValue(spectatorFixtures.seasons.hidden);
    mocks.listPoolsBySeason.mockResolvedValue([
      { id: 'pool-alice', userId: 'user-alice', user: spectatorFixtures.users.alice },
    ]);

    const response = await request(app).get('/api/leagues/test-league/seasons/2/pools');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toEqual({ poolVisibility: false });
  });

  it('returns only own pool when visibility is off for owner', async () => {
    prismaMock.season.findFirst.mockResolvedValue(spectatorFixtures.seasons.hidden);
    mocks.listPoolsBySeason.mockResolvedValue([
      { id: 'pool-alice', userId: 'user-alice', user: spectatorFixtures.users.alice },
      { id: 'pool-bob', userId: 'user-bob', user: spectatorFixtures.users.bob },
    ]);

    const response = await request(app)
      .get('/api/leagues/test-league/seasons/2/pools')
      .set('x-test-user', 'user-alice');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userId).toBe('user-alice');
    expect(response.body.meta).toEqual({ poolVisibility: false });
  });
});
