import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  confirmMatch: vi.fn(),
  recomputeStandings: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', displayName: 'User', slug: 'user', avatarUrl: null, role: 'user' };
    next();
  },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/matchService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/matchService.js')>();
  return {
    ...actual,
    confirmMatch: mocks.confirmMatch,
  };
});

vi.mock('../../services/standingsService.js', () => ({
  recomputeStandings: mocks.recomputeStandings,
}));

import app from '../../index.js';

describe('matches routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.confirmMatch.mockReset();
    mocks.recomputeStandings.mockReset();
  });

  it('validates report payload requires at least one game result', async () => {
    const response = await request(app).post('/api/matches/m1/report').send({ gameResults: [] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fields).toEqual(
      expect.objectContaining({
        gameResults: expect.any(String),
      }),
    );
  });

  it('confirms match and recomputes standings', async () => {
    mocks.confirmMatch.mockResolvedValue({ id: 'match-1', status: 'confirmed' });
    prismaMock.match.findUnique.mockResolvedValue({
      round: { event: { seasonId: 'season-1' } },
    });

    const response = await request(app).post('/api/matches/match-1/confirm');

    expect(response.status).toBe(200);
    expect(mocks.confirmMatch).toHaveBeenCalledWith('match-1', 'user-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
  });
});
