import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { confirmMatch, reportMatch } from '../../services/matchService.js';

describe('matchService', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('requires at least one game result when reporting', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });

    await expect(reportMatch('m1', 'u1', [])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'At least one game result is required',
    });
    expect(prismaMock.match.update).not.toHaveBeenCalled();
    expect(prismaMock.gameResult.create).not.toHaveBeenCalled();
  });

  it('confirms a reported match for the non-reporter participant', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'reported',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: 'u1',
      round: { status: 'in_progress', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'in_progress',
      matches: [{ status: 'confirmed' }, { status: 'resolved' }],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'confirmed', gameResults: [] });

    const result = await confirmMatch('m1', 'u2');

    expect(result.status).toBe('confirmed');
    expect(prismaMock.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        status: 'confirmed',
        confirmedAt: expect.any(Date),
      },
      include: { gameResults: true },
    });
    expect(prismaMock.round.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'completed' },
    });
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: {
        roundId: 'r1',
        userId: { in: ['u1', 'u2'] },
        status: 'submitted',
      },
      data: { status: 'locked' },
    });
  });

  it('blocks reporting when round has not started', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'not_started', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });

    await expect(reportMatch('m1', 'u1', [{ winnerId: 'u1', isDraw: false }])).rejects.toMatchObject({
      code: 'INVALID_ROUND_STATE',
      message: 'Round must be in progress to report matches',
    });
    expect(prismaMock.match.update).not.toHaveBeenCalled();
  });

  it('locks submitted decks after reporting a swiss match', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'reported', gameResults: [] });

    await reportMatch('m1', 'u1', [{ winnerId: 'u1', isDraw: false }]);

    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: {
        roundId: 'r1',
        userId: { in: ['u1', 'u2'] },
        status: 'submitted',
      },
      data: { status: 'locked' },
    });
  });

  it('does not lock decklists for round robin matches', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'round_robin' } } },
      gameResults: [],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'reported', gameResults: [] });

    await reportMatch('m1', 'u1', [{ winnerId: 'u1', isDraw: false }]);

    expect(prismaMock.decklist.updateMany).not.toHaveBeenCalled();
  });
});
