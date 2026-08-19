import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const standingsMocks = vi.hoisted(() => ({
  recomputeStandings: vi.fn(),
}));

vi.mock('../../services/standingsService.js', () => ({
  recomputeStandings: standingsMocks.recomputeStandings,
}));

import { dropPlayer } from '../../services/playerDropService.js';

function swissEvent(id = 'e1') {
  return {
    id,
    seasonId: 's1',
    config: { format: 'swiss', bestOfN: 3 },
  };
}

describe('playerDropService', () => {
  beforeEach(() => {
    resetPrismaMock();
    standingsMocks.recomputeStandings.mockReset();
    standingsMocks.recomputeStandings.mockResolvedValue(undefined);

    prismaMock.season.findUnique.mockResolvedValue({ id: 's1' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.playerDrop.findFirst.mockResolvedValue(null);
    prismaMock.playerDrop.create.mockResolvedValue({ id: 'drop-1' });
    prismaMock.match.findMany.mockResolvedValue([]);
    prismaMock.event.findMany.mockResolvedValue([swissEvent()]);
    prismaMock.match.update.mockResolvedValue({ id: 'm1' });
    prismaMock.match.delete.mockResolvedValue({ id: 'm1' });
    prismaMock.gameResult.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.gameResult.createMany.mockResolvedValue({ count: 0 });
  });

  it('throws NOT_FOUND when season is missing', async () => {
    prismaMock.season.findUnique.mockResolvedValue(null);

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', droppedById: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NOT_FOUND when user is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', droppedById: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NOT_FOUND when event is missing', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NOT_FOUND when event is outside season', async () => {
    prismaMock.event.findUnique.mockResolvedValue({ ...swissEvent('e1'), seasonId: 's2' });

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws INVALID_OPERATION when event is bracket format', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      config: { format: 'double_elimination', bestOfN: 3 },
    });

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_OPERATION' });
  });

  it('throws ALREADY_DROPPED when season drop already exists', async () => {
    prismaMock.playerDrop.findFirst.mockResolvedValue({ id: 'drop-existing' });

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', droppedById: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'ALREADY_DROPPED' });
  });

  it('throws ALREADY_DROPPED when same event drop already exists', async () => {
    prismaMock.playerDrop.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'drop-event' });
    prismaMock.event.findUnique.mockResolvedValue(swissEvent('e1'));

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'ALREADY_DROPPED' });
  });

  it('allows season drop when only event drop exists', async () => {
    prismaMock.event.findMany.mockResolvedValue([swissEvent('e1')]);

    await expect(
      dropPlayer({ userId: 'u1', seasonId: 's1', droppedById: 'admin-1' }),
    ).resolves.toMatchObject({ droppedFrom: 'season', affectedMatches: 0 });
  });

  it('converts pending swiss match to bye for remaining player', async () => {
    prismaMock.event.findUnique.mockResolvedValue(swissEvent('e1'));
    prismaMock.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        player1Id: 'u2',
        player2Id: 'u1',
        isBye: false,
        round: { event: { config: { format: 'swiss', bestOfN: 3 } } },
      },
    ]);

    const result = await dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' });

    expect(prismaMock.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        player2: { disconnect: true },
        isBye: true,
        status: 'confirmed',
        confirmedAt: expect.any(Date),
        reportedBy: { disconnect: true },
      },
    });
    expect(result.affectedMatches).toBe(1);
  });

  it('moves remaining opponent to player1 when dropper was player1', async () => {
    prismaMock.event.findUnique.mockResolvedValue(swissEvent('e1'));
    prismaMock.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        player1Id: 'u1',
        player2Id: 'u2',
        isBye: false,
        round: { event: { config: { format: 'swiss', bestOfN: 3 } } },
      },
    ]);

    await dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' });

    expect(prismaMock.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        player1: { connect: { id: 'u2' } },
        player2: { disconnect: true },
        isBye: true,
        status: 'confirmed',
        confirmedAt: expect.any(Date),
        reportedBy: { disconnect: true },
      },
    });
  });

  it('deletes pending bye awarded to dropped player', async () => {
    prismaMock.event.findUnique.mockResolvedValue(swissEvent('e1'));
    prismaMock.match.findMany.mockResolvedValue([
      {
        id: 'm-bye',
        player1Id: 'u1',
        player2Id: null,
        isBye: true,
        round: { event: { config: { format: 'swiss', bestOfN: 3 } } },
      },
    ]);

    const result = await dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' });

    expect(prismaMock.match.delete).toHaveBeenCalledWith({ where: { id: 'm-bye' } });
    expect(result.affectedMatches).toBe(1);
  });

  it('does not rewrite confirmed, reported, or disputed matches', async () => {
    prismaMock.event.findUnique.mockResolvedValue(swissEvent('e1'));
    prismaMock.match.findMany.mockResolvedValue([]);

    await dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' });

    expect(prismaMock.match.update).not.toHaveBeenCalled();
    expect(prismaMock.match.delete).not.toHaveBeenCalled();
  });

  it('does not rewrite matches in other events for event-scoped drops', async () => {
    prismaMock.event.findUnique.mockResolvedValue(swissEvent('e1'));
    prismaMock.match.findMany.mockResolvedValue([]);

    await dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' });

    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ round: { eventId: 'e1', status: { in: ['not_started', 'in_progress'] } } }),
      }),
    );
  });

  it('confirms round robin pending match as auto-loss for dropper', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      config: { format: 'round_robin', bestOfN: 3 },
    });
    prismaMock.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        player1Id: 'u1',
        player2Id: 'u2',
        isBye: false,
        round: { event: { config: { format: 'round_robin', bestOfN: 3 } } },
      },
    ]);

    const result = await dropPlayer({ userId: 'u1', seasonId: 's1', eventId: 'e1', droppedById: 'admin-1' });

    expect(prismaMock.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        status: 'confirmed',
        confirmedAt: expect.any(Date),
        isBye: false,
        reportedBy: { connect: { id: 'admin-1' } },
      },
    });
    expect(prismaMock.gameResult.deleteMany).toHaveBeenCalledWith({ where: { matchId: 'm1' } });
    expect(prismaMock.gameResult.createMany).toHaveBeenCalledWith({
      data: [
        { matchId: 'm1', gameNumber: 1, winnerId: 'u2', isDraw: false },
        { matchId: 'm1', gameNumber: 2, winnerId: 'u2', isDraw: false },
      ],
    });
    expect(prismaMock.match.delete).not.toHaveBeenCalled();
    expect(result.affectedMatches).toBe(1);
  });

  it('applies season drop to remaining swiss and round robin events', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      swissEvent('e1'),
      { id: 'e2', seasonId: 's1', config: { format: 'round_robin', bestOfN: 5 } },
    ]);
    prismaMock.match.findMany
      .mockResolvedValueOnce([
        {
          id: 'm-swiss',
          player1Id: 'u2',
          player2Id: 'u1',
          isBye: false,
          round: { event: { config: { format: 'swiss', bestOfN: 3 } } },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'm-rr',
          player1Id: 'u1',
          player2Id: 'u3',
          isBye: false,
          round: { event: { config: { format: 'round_robin', bestOfN: 5 } } },
        },
      ]);

    const result = await dropPlayer({ userId: 'u1', seasonId: 's1', droppedById: 'admin-1' });

    expect(result).toEqual({ droppedFrom: 'season', affectedMatches: 2 });
    expect(prismaMock.gameResult.createMany).toHaveBeenCalledWith({
      data: [
        { matchId: 'm-rr', gameNumber: 1, winnerId: 'u3', isDraw: false },
        { matchId: 'm-rr', gameNumber: 2, winnerId: 'u3', isDraw: false },
        { matchId: 'm-rr', gameNumber: 3, winnerId: 'u3', isDraw: false },
      ],
    });
  });

  it('skips bracket events during season drop', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'e1', seasonId: 's1', config: { format: 'double_elimination', bestOfN: 3 } },
      swissEvent('e2'),
    ]);

    await dropPlayer({ userId: 'u1', seasonId: 's1', droppedById: 'admin-1' });

    expect(prismaMock.match.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ round: { eventId: 'e2', status: { in: ['not_started', 'in_progress'] } } }),
      }),
    );
  });

  it('recomputes standings once after transaction', async () => {
    await dropPlayer({ userId: 'u1', seasonId: 's1', droppedById: 'admin-1' });

    expect(standingsMocks.recomputeStandings).toHaveBeenCalledTimes(1);
    expect(standingsMocks.recomputeStandings).toHaveBeenCalledWith('s1');
  });
});
