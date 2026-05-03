import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { recomputeStandings } from '../../services/standingsService.js';

describe('standingsService', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('recomputes standings and writes rows to prisma', async () => {
    prismaMock.season.findUnique.mockResolvedValue({
      id: 's1',
      pointConfig: { matchWinPoints: 3, matchDrawPoints: 1, matchLossPoints: 0 },
      league: { memberships: [{ userId: 'u1' }, { userId: 'u2' }] },
    });
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.match.findMany.mockResolvedValue([
      {
        isBye: false,
        player1Id: 'u1',
        player2Id: 'u2',
        gameResults: [{ winnerId: 'u1', isDraw: false }, { winnerId: 'u1', isDraw: false }],
        round: { event: { pointMultiplier: 1 } },
      },
    ]);
    prismaMock.standing.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.standing.createMany.mockResolvedValue({ count: 2 });

    await recomputeStandings('s1');

    expect(prismaMock.standing.deleteMany).toHaveBeenCalledWith({ where: { seasonId: 's1' } });
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['confirmed', 'resolved'] },
        }),
      }),
    );
    expect(prismaMock.standing.createMany).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.standing.createMany.mock.calls[0][0];
    expect(createArgs.data).toHaveLength(2);
    expect(createArgs.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'u1',
          seasonId: 's1',
          points: 3,
          matchWins: 1,
          matchLosses: 0,
        }),
        expect.objectContaining({
          userId: 'u2',
          seasonId: 's1',
          points: 0,
          matchWins: 0,
          matchLosses: 1,
        }),
      ]),
    );
  });
});
