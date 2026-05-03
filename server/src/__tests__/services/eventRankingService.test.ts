import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { getEventResults } from '../../services/eventRankingService.js';

describe('eventRankingService', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('returns sorted event-scoped rankings for completed events', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'completed',
      rounds: [
        {
          matches: [
            {
              status: 'confirmed',
              isBye: false,
              player1Id: 'u1',
              player2Id: 'u2',
              gameResults: [
                { winnerId: 'u1', isDraw: false },
                { winnerId: 'u1', isDraw: false },
              ],
            },
          ],
        },
      ],
      season: {
        league: {
          memberships: [
            { user: { id: 'u1', displayName: 'Alpha', publicName: null, slug: 'alpha', avatarUrl: null } },
            { user: { id: 'u2', displayName: 'Bravo', publicName: null, slug: 'bravo', avatarUrl: null } },
          ],
        },
      },
    });

    const result = await getEventResults('event-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ rank: 1, userId: 'u1', matchPoints: 3 });
    expect(result[1]).toMatchObject({ rank: 2, userId: 'u2', matchPoints: 0 });
  });

  it('rejects results for non-completed events', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'active',
      rounds: [],
      season: { league: { memberships: [] } },
    });

    await expect(getEventResults('event-1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Event must be completed before viewing final results',
    });
  });
});
