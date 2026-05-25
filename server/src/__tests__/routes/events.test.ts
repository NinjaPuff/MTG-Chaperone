import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  listMyDecklistsForEvent: vi.fn(),
  listMyDecklistsForRound: vi.fn(),
  startEvent: vi.fn(),
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
  getAuthUser: (req: any) => req.user,
}));

vi.mock('../../services/eventService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/eventService.js')>();
  return {
    ...actual,
    startEvent: mocks.startEvent,
  };
});

vi.mock('../../services/standingsService.js', () => ({
  recomputeStandings: mocks.recomputeStandings,
}));

vi.mock('../../services/decklistService.js', () => ({
  listMyDecklistsForEvent: mocks.listMyDecklistsForEvent,
  listMyDecklistsForRound: mocks.listMyDecklistsForRound,
}));

import app from '../../index.js';

describe('events routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.listMyDecklistsForEvent.mockReset();
    mocks.listMyDecklistsForRound.mockReset();
    mocks.startEvent.mockReset();
    mocks.recomputeStandings.mockReset();
  });

  it('starts an event', async () => {
    mocks.startEvent.mockResolvedValue({ id: 'event-1', status: 'active' });

    const response = await request(app).post('/api/events/event-1/start');

    expect(response.status).toBe(200);
    expect(mocks.startEvent).toHaveBeenCalledWith('event-1');
    expect(response.body.data.status).toBe('active');
  });

  it('validates seed uniqueness', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'setup',
      season: {
        league: {
          memberships: [
            { userId: '11111111-1111-4111-8111-111111111111' },
            { userId: '22222222-2222-4222-8222-222222222222' },
          ],
        },
      },
    });

    const response = await request(app)
      .put('/api/events/event-1/seeds')
      .send({
        seeds: [
          { userId: '11111111-1111-4111-8111-111111111111', seedNum: 1 },
          { userId: '11111111-1111-4111-8111-111111111111', seedNum: 2 },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Seed users and seed numbers must be unique');
    expect(prismaMock.eventSeed.createMany).not.toHaveBeenCalled();
  });

  it('returns event results for completed events', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'completed',
      rounds: [],
      season: {
        league: {
          memberships: [
            {
              user: {
                id: 'user-1',
                displayName: 'Player One',
                publicName: null,
                slug: 'player-one',
                avatarUrl: null,
              },
            },
          ],
        },
      },
    });

    const response = await request(app).get('/api/events/event-1/results');

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      rank: 1,
      userId: 'user-1',
      matchPoints: 0,
    });
  });

  it('returns current user round deckbuilder data', async () => {
    mocks.listMyDecklistsForRound.mockResolvedValue({
      decklists: [{ id: 'deck-1' }],
      poolId: 'pool-1',
      restrictedCards: [{ cachedCardId: 'card-a', restrictedQty: 1, reason: '1 copy played in Round 1' }],
      eventConfig: { deckCount: 2, minDeckSize: 40, sideboardRule: 'entire_pool', deckLockingMode: 'free_modification' },
      basicLandCardIds: ['basic-forest'],
    });

    const response = await request(app).get(
      '/api/events/11111111-1111-4111-8111-111111111111/rounds/22222222-2222-4222-8222-222222222222/my-decklists',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.decklists).toHaveLength(1);
    expect(mocks.listMyDecklistsForRound).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'admin-1',
    );
  });

  it('returns current user event-level deckbuilder data', async () => {
    mocks.listMyDecklistsForEvent.mockResolvedValue({
      decklists: [{ id: 'deck-1' }],
      poolId: 'pool-1',
      roundId: 'round-2',
      roundNumber: 2,
      restrictedCards: [],
      eventConfig: { deckCount: 2, minDeckSize: 40, sideboardRule: 'entire_pool', deckLockingMode: 'free_modification' },
      basicLandCardIds: ['basic-forest'],
      basicLands: [],
    });

    const response = await request(app).get('/api/events/11111111-1111-4111-8111-111111111111/my-decklists');

    expect(response.status).toBe(200);
    expect(response.body.data.roundNumber).toBe(2);
    expect(mocks.listMyDecklistsForEvent).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'admin-1');
  });
});
