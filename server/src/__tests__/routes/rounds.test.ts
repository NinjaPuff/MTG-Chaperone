import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  startRound: vi.fn(),
  completeRound: vi.fn(),
  resetRound: vi.fn(),
  deleteRound: vi.fn(),
  regenerateRoundPairings: vi.fn(),
  updateRoundPairings: vi.fn(),
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
        id: 'admin-1',
        displayName: 'Admin',
        slug: 'admin',
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

vi.mock('../../services/roundService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/roundService.js')>();
  return {
    ...actual,
    startRound: mocks.startRound,
    completeRound: mocks.completeRound,
    resetRound: mocks.resetRound,
    deleteRound: mocks.deleteRound,
    regenerateRoundPairings: mocks.regenerateRoundPairings,
  };
});

vi.mock('../../services/matchService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/matchService.js')>();
  return {
    ...actual,
    updateRoundPairings: mocks.updateRoundPairings,
  };
});

vi.mock('../../services/standingsService.js', () => ({
  recomputeStandings: mocks.recomputeStandings,
}));

import app from '../../index.js';

describe('rounds routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.startRound.mockReset();
    mocks.completeRound.mockReset();
    mocks.resetRound.mockReset();
    mocks.deleteRound.mockReset();
    mocks.regenerateRoundPairings.mockReset();
    mocks.updateRoundPairings.mockReset();
    mocks.recomputeStandings.mockReset();
  });

  it('starts round via route handler', async () => {
    mocks.startRound.mockResolvedValue({ id: 'round-1', status: 'in_progress' });
    const response = await request(app).post('/api/rounds/round-1/start').set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(mocks.startRound).toHaveBeenCalledWith('round-1');
    expect(response.body.data.status).toBe('in_progress');
  });

  it('deletes round and recomputes standings', async () => {
    mocks.deleteRound.mockResolvedValue({ seasonId: 'season-1' });
    const response = await request(app).delete('/api/rounds/round-1').set('x-test-role', 'admin');

    expect(response.status).toBe(204);
    expect(mocks.deleteRound).toHaveBeenCalledWith('round-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
  });

  it('completes round and recomputes standings', async () => {
    prismaMock.round.findUnique.mockResolvedValue({
      event: { seasonId: 'season-1' },
    });
    mocks.completeRound.mockResolvedValue({ id: 'round-1', status: 'completed' });

    const response = await request(app).post('/api/rounds/round-1/complete').set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(mocks.completeRound).toHaveBeenCalledWith('round-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
  });

  it('resets round and recomputes standings', async () => {
    prismaMock.round.findUnique.mockResolvedValue({
      event: { seasonId: 'season-1' },
    });
    mocks.resetRound.mockResolvedValue({ id: 'round-1', status: 'not_started' });

    const response = await request(app).post('/api/rounds/round-1/reset').set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(mocks.resetRound).toHaveBeenCalledWith('round-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
    expect(response.body.data.status).toBe('not_started');
  });

  it('updates round pairings for admin', async () => {
    mocks.updateRoundPairings.mockResolvedValue(undefined);
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'round-1',
      matches: [
        {
          id: 'match-1',
          player1: { id: 'u1', displayName: 'Player 1' },
          player2: { id: 'u2', displayName: 'Player 2' },
          gameResults: [],
        },
      ],
    });

    const response = await request(app)
      .put('/api/rounds/round-1/pairings')
      .set('x-test-role', 'admin')
      .send({
        pairings: [
          {
            matchId: '00000000-0000-4000-8000-000000000001',
            player1Id: '00000000-0000-4000-8000-000000000003',
            player2Id: '00000000-0000-4000-8000-000000000002',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(mocks.updateRoundPairings).toHaveBeenCalledWith('round-1', [
      {
        matchId: '00000000-0000-4000-8000-000000000001',
        player1Id: '00000000-0000-4000-8000-000000000003',
        player2Id: '00000000-0000-4000-8000-000000000002',
      },
    ]);
    expect(response.body.data.id).toBe('round-1');
  });

  it('returns 403 when non-admin updates round pairings', async () => {
    const response = await request(app)
      .put('/api/rounds/round-1/pairings')
      .send({
        pairings: [
          {
            matchId: '00000000-0000-4000-8000-000000000001',
            player1Id: '00000000-0000-4000-8000-000000000003',
            player2Id: '00000000-0000-4000-8000-000000000002',
          },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.updateRoundPairings).not.toHaveBeenCalled();
  });

  it('accepts pairings without matchId for new matches', async () => {
    mocks.updateRoundPairings.mockResolvedValue(undefined);
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'round-1',
      matches: [],
    });

    const response = await request(app)
      .put('/api/rounds/round-1/pairings')
      .set('x-test-role', 'admin')
      .send({
        pairings: [
          {
            player1Id: '00000000-0000-4000-8000-000000000001',
            player2Id: '00000000-0000-4000-8000-000000000002',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(mocks.updateRoundPairings).toHaveBeenCalledWith('round-1', [
      {
        player1Id: '00000000-0000-4000-8000-000000000001',
        player2Id: '00000000-0000-4000-8000-000000000002',
      },
    ]);
  });

  it('accepts empty pairings array to delete all matches', async () => {
    mocks.updateRoundPairings.mockResolvedValue(undefined);
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'round-1',
      matches: [],
    });

    const response = await request(app)
      .put('/api/rounds/round-1/pairings')
      .set('x-test-role', 'admin')
      .send({ pairings: [] });

    expect(response.status).toBe(200);
    expect(mocks.updateRoundPairings).toHaveBeenCalledWith('round-1', []);
  });

  it('regenerates pairings and recomputes standings', async () => {
    prismaMock.round.findUnique
      .mockResolvedValueOnce({ event: { seasonId: 'season-1' } })
      .mockResolvedValueOnce({ id: 'round-1', matches: [] });
    mocks.regenerateRoundPairings.mockResolvedValue(undefined);

    const response = await request(app).post('/api/rounds/round-1/regenerate').set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(mocks.regenerateRoundPairings).toHaveBeenCalledWith('round-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
    expect(response.body.data.id).toBe('round-1');
  });

  it('returns 409 when regenerate is not supported', async () => {
    prismaMock.round.findUnique.mockResolvedValue({ event: { seasonId: 'season-1' } });
    mocks.regenerateRoundPairings.mockRejectedValue(
      new AppError(409, 'INVALID_OPERATION', 'Regenerate pairings is only supported for swiss events'),
    );

    const response = await request(app).post('/api/rounds/round-1/regenerate').set('x-test-role', 'admin');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_OPERATION');
    expect(mocks.recomputeStandings).not.toHaveBeenCalled();
  });
});
