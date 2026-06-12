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
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 3 });

    const count = await unlockDecklistsForRound(prismaMock as any, 'round-1');

    expect(count).toBe(3);
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: {
        roundId: 'round-1',
        status: 'locked',
      },
      data: {
        status: 'draft',
      },
    });
  });

  it('returns zero when no decklists are unlocked', async () => {
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 0 });

    const count = await unlockDecklistsForRound(prismaMock as any, 'round-2');

    expect(count).toBe(0);
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledTimes(1);
  });
});
