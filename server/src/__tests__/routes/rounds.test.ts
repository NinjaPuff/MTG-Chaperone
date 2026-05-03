import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  startRound: vi.fn(),
  deleteRound: vi.fn(),
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
    req.user = { id: 'admin-1', displayName: 'Admin', slug: 'admin', avatarUrl: null, role: 'admin' };
    next();
  },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/roundService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/roundService.js')>();
  return {
    ...actual,
    startRound: mocks.startRound,
    deleteRound: mocks.deleteRound,
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
    mocks.deleteRound.mockReset();
    mocks.recomputeStandings.mockReset();
  });

  it('starts round via route handler', async () => {
    mocks.startRound.mockResolvedValue({ id: 'round-1', status: 'in_progress' });
    const response = await request(app).post('/api/rounds/round-1/start');

    expect(response.status).toBe(200);
    expect(mocks.startRound).toHaveBeenCalledWith('round-1');
    expect(response.body.data.status).toBe('in_progress');
  });

  it('deletes round and recomputes standings', async () => {
    mocks.deleteRound.mockResolvedValue({ seasonId: 'season-1' });
    const response = await request(app).delete('/api/rounds/round-1');

    expect(response.status).toBe(204);
    expect(mocks.deleteRound).toHaveBeenCalledWith('round-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
  });
});
