import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { completeEvent, startEvent } from '../../services/eventService.js';

describe('eventService', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('starts setup events when no other active event exists', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      status: 'setup',
      totalRounds: null,
      config: { format: 'swiss' },
      season: { leagueId: 'l1' },
    });
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.leagueMembership.count.mockResolvedValue(8);
    prismaMock.event.update.mockResolvedValue({ id: 'e1', status: 'active', config: {} });

    const result = await startEvent('e1');

    expect(result.status).toBe('active');
    expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
      where: {
        seasonId: 's1',
        status: 'active',
        id: { not: 'e1' },
      },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: 'active', totalRounds: 3 },
      include: { config: true },
    });
  });

  it('blocks completion when event has unfinished rounds', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'active',
      rounds: [{ status: 'in_progress' }],
    });

    await expect(completeEvent('e1')).rejects.toMatchObject({
      code: 'ROUND_INCOMPLETE',
      message: 'All rounds must be completed first',
    });
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });
});
