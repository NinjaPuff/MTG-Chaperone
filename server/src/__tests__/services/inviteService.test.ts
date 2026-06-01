import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
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

const baseInvite = {
  id: 'inv1',
  leagueId: 'league-1',
  token: 'token-123',
  status: 'active' as const,
  expiresAt: null,
  maxUses: 5,
  useCount: 1,
  league: {
    id: 'league-1',
    slug: 'league-a',
    name: 'League A',
    description: null,
  },
};

function getAppError(fn: () => Promise<unknown>) {
  return fn().then(
    () => {
      throw new Error('Expected AppError to be thrown');
    },
    (error) => {
      if (!(error instanceof AppError)) {
        throw error;
      }
      return error;
    },
  );
}

describe('inviteService', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.addMember.mockReset();
    mocks.addMember.mockResolvedValue(undefined);
    prismaMock.inviteLink.findFirst.mockResolvedValue(baseInvite);
    prismaMock.leagueMembership.findUnique.mockResolvedValue(null);
    prismaMock.inviteLink.update.mockResolvedValue({ id: 'inv1' });
    prismaMock.leagueMembership.create.mockResolvedValue({ id: 'm1' });
  });

  it('consumes a use and creates membership for a new member', async () => {
    const league = await validateAndJoin('token-123', 'user-1');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.inviteLink.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { useCount: { increment: 1 } },
    });
    expect(prismaMock.leagueMembership.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        leagueId: 'league-1',
      },
    });
    expect(mocks.addMember).toHaveBeenCalledWith('league-a', 'user-1');
    expect(league).toEqual(
      expect.objectContaining({
        slug: 'league-a',
      }),
    );
  });

  it('does not consume a use when the user is already a member', async () => {
    prismaMock.leagueMembership.findUnique.mockResolvedValue({ id: 'm1' });

    const league = await validateAndJoin('token-123', 'user-1');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.inviteLink.update).not.toHaveBeenCalled();
    expect(prismaMock.leagueMembership.create).not.toHaveBeenCalled();
    expect(mocks.addMember).not.toHaveBeenCalled();
    expect(league).toEqual(
      expect.objectContaining({
        slug: 'league-a',
      }),
    );
  });

  it('blocks new users when the invite is exhausted', async () => {
    prismaMock.inviteLink.findFirst.mockResolvedValue({
      ...baseInvite,
      maxUses: 1,
      useCount: 1,
    });

    const error = await getAppError(() => validateAndJoin('token-123', 'user-1'));

    expect(error.code).toBe('INVITE_EXHAUSTED');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.inviteLink.update).not.toHaveBeenCalled();
    expect(prismaMock.leagueMembership.create).not.toHaveBeenCalled();
    expect(mocks.addMember).not.toHaveBeenCalled();
  });

  it('allows existing members to join when the invite is exhausted', async () => {
    prismaMock.inviteLink.findFirst.mockResolvedValue({
      ...baseInvite,
      maxUses: 1,
      useCount: 1,
    });
    prismaMock.leagueMembership.findUnique.mockResolvedValue({ id: 'm1' });

    const league = await validateAndJoin('token-123', 'user-1');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.inviteLink.update).not.toHaveBeenCalled();
    expect(league).toEqual(
      expect.objectContaining({
        slug: 'league-a',
      }),
    );
  });

  it('blocks revoked invites even for existing members', async () => {
    prismaMock.inviteLink.findFirst.mockResolvedValue({
      ...baseInvite,
      status: 'revoked',
    });
    prismaMock.leagueMembership.findUnique.mockResolvedValue({ id: 'm1' });

    const error = await getAppError(() => validateAndJoin('token-123', 'user-1'));

    expect(error.code).toBe('INVALID_INVITE');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.inviteLink.update).not.toHaveBeenCalled();
    expect(mocks.addMember).not.toHaveBeenCalled();
  });

  it('consumes only one use when join is attempted twice', async () => {
    let membershipExists = false;
    prismaMock.leagueMembership.findUnique.mockImplementation(async () =>
      membershipExists ? { id: 'm1' } : null,
    );
    prismaMock.$transaction.mockImplementation(async (fn) => {
      const result = await (fn as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      membershipExists = true;
      return result;
    });

    await validateAndJoin('token-123', 'user-1');
    await validateAndJoin('token-123', 'user-1');

    expect(prismaMock.inviteLink.update).toHaveBeenCalledTimes(1);
    expect(mocks.addMember).toHaveBeenCalledTimes(1);
  });
});
