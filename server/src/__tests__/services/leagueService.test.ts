import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

const mocks = vi.hoisted(() => ({
  recomputeStandings: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../services/standingsService.js', () => ({
  recomputeStandings: mocks.recomputeStandings,
}));

import { addMember } from '../../services/leagueService.js';

describe('leagueService', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.recomputeStandings.mockReset();
  });

  it('adds membership with upsert and recomputes active season standings', async () => {
    prismaMock.league.findUnique
      .mockResolvedValueOnce({ id: 'league-1' })
      .mockResolvedValueOnce({ id: 'league-1' });
    prismaMock.leagueMembership.upsert.mockResolvedValue({ id: 'membership-1' });
    prismaMock.season.findMany.mockResolvedValue([
      { id: 'season-1', pointConfig: { id: 'pc1' } },
      { id: 'season-2', pointConfig: null },
    ]);

    const membership = await addMember('league-a', 'user-1');

    expect(membership.id).toBe('membership-1');
    expect(prismaMock.leagueMembership.upsert).toHaveBeenCalledWith({
      where: {
        userId_leagueId: {
          userId: 'user-1',
          leagueId: 'league-1',
        },
      },
      update: {},
      create: {
        userId: 'user-1',
        leagueId: 'league-1',
      },
    });
    expect(mocks.recomputeStandings).toHaveBeenCalledWith('season-1');
    expect(mocks.recomputeStandings).toHaveBeenCalledTimes(1);
  });
});
