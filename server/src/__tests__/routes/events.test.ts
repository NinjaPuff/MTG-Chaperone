import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  listMyDecklistsForEvent: vi.fn(),
  listMyDecklistsForRound: vi.fn(),
  listVisibleDecklistsForEvent: vi.fn(),
  startEvent: vi.fn(),
  updateEvent: vi.fn(),
  resetEvent: vi.fn(),
  recomputeStandings: vi.fn(),
  getBracketState: vi.fn(),
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
      req.user = { id: 'admin-1', displayName: 'Admin', slug: 'admin', avatarUrl: null, role: 'admin' };
      next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
    getAuthUser: (req: any) => req.user,
  };
});

vi.mock('../../services/eventService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/eventService.js')>();
  return {
    ...actual,
    startEvent: mocks.startEvent,
    updateEvent: mocks.updateEvent,
    resetEvent: mocks.resetEvent,
  };
});

vi.mock('../../services/standingsService.js', () => ({
  recomputeStandings: mocks.recomputeStandings,
}));

vi.mock('../../services/decklistService.js', () => ({
  listMyDecklistsForEvent: mocks.listMyDecklistsForEvent,
  listMyDecklistsForRound: mocks.listMyDecklistsForRound,
  listVisibleDecklistsForEvent: mocks.listVisibleDecklistsForEvent,
}));
vi.mock('../../services/bracketService.js', () => ({
  getBracketState: mocks.getBracketState,
}));

import app from '../../index.js';

describe('events routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.listMyDecklistsForEvent.mockReset();
    mocks.listMyDecklistsForRound.mockReset();
    mocks.listVisibleDecklistsForEvent.mockReset();
    mocks.startEvent.mockReset();
    mocks.updateEvent.mockReset();
    mocks.resetEvent.mockReset();
    mocks.recomputeStandings.mockReset();
    mocks.getBracketState.mockReset();
  });

  it('starts an event', async () => {
    mocks.startEvent.mockResolvedValue({ id: 'event-1', status: 'active' });

    const response = await request(app).post('/api/events/event-1/start');

    expect(response.status).toBe(200);
    expect(mocks.startEvent).toHaveBeenCalledWith('event-1');
    expect(response.body.data.status).toBe('active');
  });

  it('patches event settings and recomputes standings when multiplier changes', async () => {
    mocks.updateEvent.mockResolvedValue({
      id: 'event-1',
      name: 'Week 1',
      season: { id: 'season-1' },
      config: { deckCount: 2 },
    });

    const response = await request(app).patch('/api/events/event-1').send({
      pointMultiplier: 1.5,
      config: { deckCount: 2 },
    });

    expect(response.status).toBe(200);
    expect(mocks.updateEvent).toHaveBeenCalledWith('event-1', {
      pointMultiplier: 1.5,
      config: { deckCount: 2 },
    });
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
  });

  it('returns service errors from patch event settings', async () => {
    mocks.updateEvent.mockRejectedValue(new AppError(409, 'INVALID_EVENT_STATE', 'Only setup events can be edited'));

    const response = await request(app).patch('/api/events/event-1').send({
      name: 'Week 1 updated',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_EVENT_STATE');
    expect(mocks.recomputeStandings).not.toHaveBeenCalled();
  });

  it('resets event and recomputes standings', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      seasonId: 'season-1',
    });
    mocks.resetEvent.mockResolvedValue({ id: 'event-1', status: 'setup' });

    const response = await request(app).post('/api/events/event-1/reset');

    expect(response.status).toBe(200);
    expect(mocks.resetEvent).toHaveBeenCalledWith('event-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
    expect(response.body.data.status).toBe('setup');
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

  it('returns bracket state for an event', async () => {
    mocks.getBracketState.mockResolvedValue([{ id: 'slot-1' }]);

    const response = await request(app).get('/api/events/event-1/bracket');

    expect(response.status).toBe(200);
    expect(mocks.getBracketState).toHaveBeenCalledWith('event-1');
    expect(response.body.data).toEqual([{ id: 'slot-1' }]);
  });

  it('returns current user round deckbuilder data', async () => {
    mocks.listMyDecklistsForRound.mockResolvedValue({
      decklists: [{ id: 'deck-1' }],
      poolId: 'pool-1',
      restrictedCards: [{ cachedCardId: 'card-a', restrictedQty: 1, reason: '1 copy played in Round 1' }],
      eventConfig: { deckCount: 2, minDeckSize: 40, sideboardRule: 'entire_pool', deckLockingMode: 'free_modification' },
      basicLandCardIds: ['basic-forest'],
      matchesComplete: true,
    });

    const response = await request(app).get(
      '/api/events/11111111-1111-4111-8111-111111111111/rounds/22222222-2222-4222-8222-222222222222/my-decklists',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.decklists).toHaveLength(1);
    expect(response.body.data.matchesComplete).toBe(true);
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

  it('omits not_started rounds when schedule visibility is off for anonymous viewers', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      season: {
        scheduleVisibility: false,
        poolVisibility: false,
        decklistVisibility: false,
      },
    });
    prismaMock.round.findMany.mockResolvedValue([
      { id: 'round-1', status: 'in_progress', roundNumber: 1, matches: [] },
    ]);

    const response = await request(app).get('/api/events/event-1/rounds');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(prismaMock.round.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'event-1',
          status: { not: 'not_started' },
        }),
      }),
    );
  });

  it.each([41, 45, 100])('rejects PATCH minDeckSize %s', async (minDeckSize) => {
    const response = await request(app)
      .patch('/api/events/event-1')
      .send({ config: { minDeckSize } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fields['config.minDeckSize']).toBeDefined();
    expect(mocks.updateEvent).not.toHaveBeenCalled();
  });

  it('accepts PATCH minDeckSize 60', async () => {
    mocks.updateEvent.mockResolvedValue({ id: 'event-1', season: { id: 'season-1' } });

    const response = await request(app)
      .patch('/api/events/event-1')
      .send({ config: { minDeckSize: 60 } });

    expect(response.status).toBe(200);
    expect(mocks.updateEvent).toHaveBeenCalledWith('event-1', { config: { minDeckSize: 60 } });
  });

  it('allows PATCH that omits minDeckSize', async () => {
    mocks.updateEvent.mockResolvedValue({ id: 'event-1', season: { id: 'season-1' } });

    const response = await request(app).patch('/api/events/event-1').send({ name: 'Week 1 updated' });

    expect(response.status).toBe(200);
    expect(mocks.updateEvent).toHaveBeenCalledWith('event-1', { name: 'Week 1 updated' });
  });

  it('lists visible event decklists for anonymous viewers', async () => {
    mocks.listVisibleDecklistsForEvent.mockResolvedValue([{ id: 'alice-w2-r1' }]);

    const response = await request(app).get('/api/events/week-2/decklists');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: 'alice-w2-r1' }]);
    expect(mocks.listVisibleDecklistsForEvent).toHaveBeenCalledWith('week-2', null);
    expect(prismaMock.decklist.findMany).not.toHaveBeenCalled();
  });

  it('passes the authenticated viewer to listVisibleDecklistsForEvent', async () => {
    mocks.listVisibleDecklistsForEvent.mockResolvedValue([{ id: 'alice-w2-r1' }]);

    const response = await request(app).get('/api/events/week-2/decklists').set('x-test-user', 'user-charlie');

    expect(response.status).toBe(200);
    expect(mocks.listVisibleDecklistsForEvent).toHaveBeenCalledWith('week-2', {
      id: 'user-charlie',
      role: 'user',
    });
  });

  it('returns 404 when listVisibleDecklistsForEvent cannot find the event', async () => {
    mocks.listVisibleDecklistsForEvent.mockRejectedValue(new AppError(404, 'NOT_FOUND', 'Event not found'));

    const response = await request(app).get('/api/events/missing/decklists');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
