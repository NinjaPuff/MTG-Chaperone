import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { completeRound, createRound, deleteRound, startRound } from '../../services/roundService.js';

describe('roundService', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('starts a round from not_started state', async () => {
    prismaMock.round.findUnique.mockResolvedValue({ id: 'r1', status: 'not_started' });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'in_progress' });

    const result = await startRound('r1');

    expect(result.status).toBe('in_progress');
    expect(prismaMock.round.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'in_progress' },
    });
    expect(prismaMock.round.findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('does not allow deleting not_started rounds', async () => {
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'not_started',
      event: { seasonId: 's1', config: { format: 'swiss' } },
    });

    await expect(deleteRound('r1')).rejects.toMatchObject({
      code: 'INVALID_ROUND_STATE',
      message: 'Only in-progress or completed rounds can be deleted',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('completes round when all matches are reported or better and auto-confirms reported matches', async () => {
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'in_progress',
      matches: [{ status: 'reported' }, { status: 'confirmed' }],
    });
    prismaMock.match.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'completed' });

    const result = await completeRound('r1');

    expect(result.status).toBe('completed');
    expect(prismaMock.match.updateMany).toHaveBeenCalledWith({
      where: { roundId: 'r1', status: 'reported' },
      data: { status: 'confirmed', confirmedAt: expect.any(Date) },
    });
    expect(prismaMock.round.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'completed' },
    });
  });

  it('rejects manual round creation for round robin events', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      totalRounds: null,
      config: { format: 'round_robin' },
      rounds: [],
      season: { league: { memberships: [] } },
    });

    await expect(createRound('e1')).rejects.toMatchObject({
      code: 'INVALID_OPERATION',
      message: 'Round robin events do not support manual round creation',
    });
  });
});
