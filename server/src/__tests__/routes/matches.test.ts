import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  confirmMatch: vi.fn(),
  updateMatchPlayers: vi.fn(),
  recomputeStandings: vi.fn(),
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
        id: 'user-1',
        displayName: 'User',
        slug: 'user',
        avatarUrl: null,
        role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'user',
      };
      next();
    },
    requireAdmin: (req: any, _res: any, next: any) => {
      if (req.user?.role !== 'admin') {
        next(new AppError(403, 'FORBIDDEN', 'Admin access required'));
        return;
      }
      next();
    },
  };
});

vi.mock('../../services/matchService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/matchService.js')>();
  return {
    ...actual,
    confirmMatch: mocks.confirmMatch,
    updateMatchPlayers: mocks.updateMatchPlayers,
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
    mocks.updateMatchPlayers.mockReset();
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

  it('updates match players for admin', async () => {
    mocks.updateMatchPlayers.mockResolvedValue({ id: 'match-1', player1Id: 'u3', player2Id: 'u2' });
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-1',
      player1: { id: 'u3', displayName: 'Player 3' },
      player2: { id: 'u2', displayName: 'Player 2' },
      gameResults: [],
      round: { event: { id: 'event-1' } },
    });

    const response = await request(app)
      .patch('/api/matches/match-1/players')
      .set('x-test-role', 'admin')
      .send({ player1Id: '00000000-0000-4000-8000-000000000003' });

    expect(response.status).toBe(200);
    expect(mocks.updateMatchPlayers).toHaveBeenCalledWith('match-1', {
      player1Id: '00000000-0000-4000-8000-000000000003',
    });
    expect(response.body.data.id).toBe('match-1');
  });

  it('returns 403 when non-admin updates match players', async () => {
    const response = await request(app)
      .patch('/api/matches/match-1/players')
      .send({ player1Id: '00000000-0000-4000-8000-000000000003' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.updateMatchPlayers).not.toHaveBeenCalled();
  });

  it('returns 400 when update payload is empty', async () => {
    const response = await request(app)
      .patch('/api/matches/match-1/players')
      .set('x-test-role', 'admin')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mocks.updateMatchPlayers).not.toHaveBeenCalled();
  });
});
