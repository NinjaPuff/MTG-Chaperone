import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const pairingMocks = vi.hoisted(() => ({
  resolveSeededPlayerOrder: vi.fn(),
}));

vi.mock('../../services/pairingService.js', () => pairingMocks);

import {
  advanceBracket,
  ensureBracketSeeds,
  getBracketState,
  initializeBracket,
  resetBracketEvent,
  syncBracketPairings,
} from '../../services/bracketService.js';

describe('bracketService', () => {
  beforeEach(() => {
    resetPrismaMock();
    pairingMocks.resolveSeededPlayerOrder.mockReset();
  });

  it('initializes bracket slots and creates first wave round/matches', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'setup',
      config: { format: 'custom_10_player', grandFinalsReset: true },
      season: {
        league: {
          memberships: Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}` })),
        },
      },
    });
    prismaMock.eventSeed.findMany.mockResolvedValue(
      Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}`, seedNum: index + 1 })),
    );
    prismaMock.bracketSlot.createMany.mockResolvedValue({ count: 15 });
    prismaMock.round.create.mockResolvedValue({ id: 'round-1' });
    prismaMock.match.create.mockImplementation(async ({ data }) => ({ id: `m-${data.player1Id}-${data.player2Id ?? 'bye'}` }));
    prismaMock.bracketSlot.update.mockResolvedValue({ id: 'slot-updated' });

    await initializeBracket('event-1');

    expect(prismaMock.bracketSlot.createMany).toHaveBeenCalled();
    expect(prismaMock.round.create).toHaveBeenCalledWith({
      data: {
        eventId: 'event-1',
        roundNumber: 1,
        status: 'in_progress',
      },
    });
    expect(prismaMock.match.create).toHaveBeenCalled();
  });

  it('requires manual seeds before bracket start', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      config: { format: 'custom_10_player', seedingSource: 'manual' },
      season: {
        league: {
          memberships: Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}` })),
        },
      },
    });
    prismaMock.eventSeed.findMany.mockResolvedValue([]);

    await expect(ensureBracketSeeds('event-1')).rejects.toMatchObject({
      code: 'SEEDS_NOT_SET',
    });
    expect(pairingMocks.resolveSeededPlayerOrder).not.toHaveBeenCalled();
  });

  it('requires a seeding source for bracket start', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      config: { format: 'custom_10_player', seedingSource: null },
      season: {
        league: {
          memberships: Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}` })),
        },
      },
    });
    prismaMock.eventSeed.findMany.mockResolvedValue([]);

    await expect(ensureBracketSeeds('event-1')).rejects.toMatchObject({
      code: 'SEEDING_SOURCE_REQUIRED',
    });
  });

  it('persists seeds from configured seeding source before bracket start', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      config: { format: 'custom_10_player', seedingSource: 'current_season' },
      season: {
        league: {
          memberships: Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}` })),
        },
      },
    });
    prismaMock.eventSeed.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}`, seedNum: index + 1 })),
      );
    pairingMocks.resolveSeededPlayerOrder.mockResolvedValue(
      Array.from({ length: 10 }).map((_, index) => `u${index + 1}`),
    );
    prismaMock.eventSeed.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.eventSeed.createMany.mockResolvedValue({ count: 10 });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));

    const seeds = await ensureBracketSeeds('event-1');

    expect(pairingMocks.resolveSeededPlayerOrder).toHaveBeenCalledWith('event-1', { strict: true });
    expect(prismaMock.eventSeed.createMany).toHaveBeenCalledWith({
      data: Array.from({ length: 10 }).map((_, index) => ({
        eventId: 'event-1',
        userId: `u${index + 1}`,
        seedNum: index + 1,
      })),
    });
    expect(seeds).toHaveLength(10);
  });

  it('advances downstream slots after winner is confirmed', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-1',
      round: { eventId: 'event-1', event: { config: { format: 'custom_10_player', grandFinalsReset: true } } },
      player1Id: 'u3',
      player2Id: 'u6',
      gameResults: [
        { winnerId: 'u3', isDraw: false },
        { winnerId: 'u3', isDraw: false },
      ],
    });
    prismaMock.bracketSlot.findUnique.mockResolvedValue({
      id: 'slot-w1',
      slotKey: 'W1',
      winnerId: null,
      eventId: 'event-1',
      matchId: 'match-1',
    });
    prismaMock.bracketSlot.findMany
      .mockResolvedValueOnce([
        {
          id: 'slot-w3',
          slotKey: 'W3',
          bracketSide: 'winners',
          player1Id: 'u1',
          player2Id: 'u3',
          matchId: null,
          bracketRound: 2,
          winnerId: null,
          loserId: null,
          match: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'slot-w3',
          slotKey: 'W3',
          bracketSide: 'winners',
          player1Id: 'u1',
          player2Id: 'u3',
          matchId: null,
          bracketRound: 2,
          winnerId: null,
          loserId: null,
          match: null,
        },
      ])
      .mockResolvedValueOnce([
        { slotKey: 'W3', matchId: 'match-2', winnerId: null },
        { slotKey: 'W1', matchId: 'match-1', winnerId: 'u3' },
      ]);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      config: { format: 'custom_10_player', grandFinalsReset: true },
      season: {
        league: {
          memberships: Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}` })),
        },
      },
    });
    prismaMock.eventSeed.findMany.mockResolvedValue(
      Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}`, seedNum: index + 1 })),
    );
    prismaMock.bracketSlot.update.mockResolvedValue({ id: 'slot-updated' });
    prismaMock.round.findFirst.mockResolvedValue({ id: 'round-2' });
    prismaMock.match.create.mockResolvedValue({ id: 'match-2' });
    prismaMock.event.update.mockResolvedValue({ id: 'event-1', status: 'completed' });

    await advanceBracket('match-1');

    expect(prismaMock.bracketSlot.update).toHaveBeenCalled();
  });

  it('is idempotent when slot already has winner', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-1',
      round: { eventId: 'event-1', event: { config: { format: 'custom_10_player', grandFinalsReset: true } } },
      player1Id: 'u3',
      player2Id: 'u6',
      gameResults: [{ winnerId: 'u3', isDraw: false }],
    });
    prismaMock.bracketSlot.findUnique.mockResolvedValue({
      id: 'slot-w1',
      slotKey: 'W1',
      winnerId: 'u3',
      eventId: 'event-1',
      matchId: 'match-1',
    });

    await advanceBracket('match-1');

    expect(prismaMock.bracketSlot.update).not.toHaveBeenCalled();
    expect(prismaMock.match.create).not.toHaveBeenCalled();
  });

  it('resets bracket event data', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'active',
    });
    prismaMock.gameResult.deleteMany.mockResolvedValue({ count: 4 });
    prismaMock.match.deleteMany.mockResolvedValue({ count: 4 });
    prismaMock.round.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.bracketSlot.deleteMany.mockResolvedValue({ count: 15 });
    prismaMock.event.update.mockResolvedValue({ id: 'event-1', status: 'setup' });

    await resetBracketEvent('event-1');

    expect(prismaMock.bracketSlot.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-1' } });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'setup', totalRounds: null },
    });
  });

  it('returns bracket state with slots', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      config: { format: 'custom_10_player', grandFinalsReset: true },
      season: {
        league: {
          memberships: Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}` })),
        },
      },
    });
    prismaMock.bracketSlot.findMany.mockResolvedValue([{ id: 'slot-1' }, { id: 'slot-2' }]);

    const result = await getBracketState('event-1');

    expect(prismaMock.bracketSlot.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'slot-1' });
    expect(result[1]).toMatchObject({ id: 'slot-2' });
  });

  it('creates pending matches for ready slots after feeder reports are synced', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      config: { format: 'custom_10_player', grandFinalsReset: true },
      season: {
        league: {
          memberships: Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}` })),
        },
      },
    });
    prismaMock.eventSeed.findMany.mockResolvedValue(
      Array.from({ length: 10 }).map((_, index) => ({ userId: `u${index + 1}`, seedNum: index + 1 })),
    );
    prismaMock.bracketSlot.findMany
      .mockResolvedValueOnce([
        {
          id: 'slot-w1',
          slotKey: 'W1',
          bracketSide: 'winners',
          bracketRound: 1,
          player1Id: 'u3',
          player2Id: 'u6',
          matchId: 'match-1',
          winnerId: null,
          loserId: null,
          match: {
            status: 'reported',
            player1Id: 'u3',
            player2Id: 'u6',
            gameResults: [
              { winnerId: 'u3', isDraw: false },
              { winnerId: 'u3', isDraw: false },
            ],
          },
        },
        {
          id: 'slot-w3',
          slotKey: 'W3',
          bracketSide: 'winners',
          bracketRound: 2,
          player1Id: 'u1',
          player2Id: null,
          matchId: null,
          winnerId: null,
          loserId: null,
          match: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'slot-w3',
          slotKey: 'W3',
          bracketSide: 'winners',
          bracketRound: 2,
          player1Id: 'u1',
          player2Id: 'u3',
          matchId: null,
          winnerId: null,
          loserId: null,
          match: null,
        },
      ]);
    prismaMock.bracketSlot.update.mockResolvedValue({ id: 'slot-w3' });
    prismaMock.round.findFirst.mockResolvedValue(null);
    prismaMock.round.create.mockResolvedValue({ id: 'round-2' });
    prismaMock.match.create.mockResolvedValue({ id: 'match-w3' });

    await syncBracketPairings('event-1');

    expect(prismaMock.bracketSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-w3' },
      data: { player2Id: 'u3' },
    });
    expect(prismaMock.match.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-2',
        player1Id: 'u1',
        player2Id: 'u3',
        isBye: false,
        status: 'pending',
      },
    });
  });
});
