import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

const mocks = vi.hoisted(() => ({
  addMember: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../services/leagueService.js', () => ({
  addMember: mocks.addMember,
}));

import { validateAndJoin } from '../../services/inviteService.js';

describe('inviteService', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.addMember.mockReset();
  });

  it('validates invite, increments use count, and adds member', async () => {
    prismaMock.inviteLink.findFirst.mockResolvedValue({
      id: 'inv1',
      status: 'active',
      expiresAt: null,
      maxUses: 5,
      useCount: 1,
      league: {
        slug: 'league-a',
      },
    });
    prismaMock.inviteLink.update.mockResolvedValue({ id: 'inv1' });

    const league = await validateAndJoin('token-123', 'user-1');

    expect(prismaMock.inviteLink.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { useCount: { increment: 1 } },
    });
    expect(mocks.addMember).toHaveBeenCalledWith('league-a', 'user-1');
    expect(mocks.addMember).toHaveBeenCalledTimes(1);
    expect(league).toEqual(
      expect.objectContaining({
        slug: 'league-a',
      }),
    );
  });
});
