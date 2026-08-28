import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { unlockDecklistsForRound } from '../../services/decklistService.js';

describe('unlockDecklistsForRound', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('unlocks locked decklists for a round', async () => {
    prismaMock.round.findUnique.mockResolvedValue({ eventId: 'week-2' });
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 3 });

    const count = await unlockDecklistsForRound(prismaMock as any, 'round-2');

    expect(count).toBe(3);
    expect(prismaMock.round.findUnique).toHaveBeenCalledWith({
      where: { id: 'round-2' },
      select: { eventId: true },
    });
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'week-2',
        status: 'locked',
      },
      data: {
        status: 'draft',
      },
    });
  });

  it('returns zero when no decklists are unlocked', async () => {
    prismaMock.round.findUnique.mockResolvedValue({ eventId: 'week-2' });
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 0 });

    const count = await unlockDecklistsForRound(prismaMock as any, 'round-2');

    expect(count).toBe(0);
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledTimes(1);
  });
});
