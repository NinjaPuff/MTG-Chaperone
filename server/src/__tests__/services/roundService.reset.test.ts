import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

const pairingMocks = vi.hoisted(() => ({
  assignRoundRobinPairings: vi.fn(),
  generateRoundRobinSchedule: vi.fn(),
  generateSeededSwissPairings: vi.fn(),
  generateSwissPairings: vi.fn(),
  regeneratePairings: vi.fn(),
}));

const decklistMocks = vi.hoisted(() => ({
  unlockDecklistsForRound: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../services/pairingService.js', () => pairingMocks);
vi.mock('../../services/decklistService.js', () => decklistMocks);

import { resetRound } from '../../services/roundService.js';

describe('roundService resetRound', () => {
  beforeEach(() => {
    resetPrismaMock();
    pairingMocks.assignRoundRobinPairings.mockReset();
    pairingMocks.generateRoundRobinSchedule.mockReset();
    pairingMocks.generateSeededSwissPairings.mockReset();
    pairingMocks.generateSwissPairings.mockReset();
    pairingMocks.regeneratePairings.mockReset();
    decklistMocks.unlockDecklistsForRound.mockReset();
    decklistMocks.unlockDecklistsForRound.mockResolvedValue(1);
  });

  it('resets an in_progress swiss round to not_started and re-pairs', async () => {
    prismaMock.round.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        eventId: 'e1',
        status: 'in_progress',
        matches: [],
        event: { status: 'active', config: { format: 'swiss' } },
      })
      .mockResolvedValueOnce({ id: 'r1', status: 'not_started', matches: [{ id: 'm1' }] });
    prismaMock.gameResult.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.match.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'not_started' });
    pairingMocks.generateSwissPairings.mockResolvedValue([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });

    const result = await resetRound('r1');

    expect(prismaMock.gameResult.deleteMany).toHaveBeenCalledWith({
      where: { match: { roundId: 'r1' } },
    });
    expect(prismaMock.match.deleteMany).toHaveBeenCalledWith({
      where: { roundId: 'r1' },
    });
    expect(decklistMocks.unlockDecklistsForRound).toHaveBeenCalled();
    expect(prismaMock.round.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'not_started' },
    });
    expect(pairingMocks.generateSwissPairings).toHaveBeenCalledWith('r1');
    expect(result).toEqual({ id: 'r1', status: 'not_started', matches: [{ id: 'm1' }] });
  });

  it('moves event back to active when resetting a completed round from completed event', async () => {
    prismaMock.round.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        eventId: 'e1',
        status: 'completed',
        matches: [],
        event: { status: 'completed', config: { format: 'swiss' } },
      })
      .mockResolvedValueOnce({ id: 'r1', status: 'not_started', matches: [] });
    prismaMock.gameResult.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.match.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'not_started' });
    prismaMock.event.update.mockResolvedValue({ id: 'e1', status: 'active' });
    pairingMocks.generateSwissPairings.mockResolvedValue([]);

    await resetRound('r1');

    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: 'active' },
    });
  });

  it('rejects reset for not_started rounds', async () => {
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      eventId: 'e1',
      status: 'not_started',
      matches: [],
      event: { status: 'active', config: { format: 'swiss' } },
    });

    await expect(resetRound('r1')).rejects.toMatchObject({
      code: 'INVALID_ROUND_STATE',
    });
    expect(prismaMock.gameResult.deleteMany).not.toHaveBeenCalled();
  });

  it('preserves pairings when resetting a round robin round', async () => {
    const originalMatches = [
      { player1Id: 'u1', player2Id: 'u2', isBye: false },
      { player1Id: 'u3', player2Id: 'u4', isBye: false },
    ];
    prismaMock.round.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        eventId: 'e1',
        status: 'completed',
        matches: originalMatches,
        event: { status: 'active', config: { format: 'round_robin' } },
      })
      .mockResolvedValueOnce({ id: 'r1', status: 'not_started', matches: [] });
    prismaMock.gameResult.deleteMany.mockResolvedValue({ count: 4 });
    prismaMock.match.deleteMany.mockResolvedValue({ count: 4 });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'not_started' });
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });

    await resetRound('r1');

    expect(prismaMock.scheduledPairing.updateMany).not.toHaveBeenCalled();
    expect(pairingMocks.assignRoundRobinPairings).not.toHaveBeenCalled();
    expect(pairingMocks.generateSwissPairings).not.toHaveBeenCalled();
    expect(prismaMock.match.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.match.create).toHaveBeenNthCalledWith(1, {
      data: {
        roundId: 'r1',
        player1Id: 'u1',
        player2Id: 'u2',
        isBye: false,
        status: 'pending',
        confirmedAt: null,
      },
    });
    expect(prismaMock.match.create).toHaveBeenNthCalledWith(2, {
      data: {
        roundId: 'r1',
        player1Id: 'u3',
        player2Id: 'u4',
        isBye: false,
        status: 'pending',
        confirmedAt: null,
      },
    });
  });

  it('preserves pairings for round robin with no scheduledPairings', async () => {
    const originalMatches = [{ player1Id: 'u1', player2Id: 'u2', isBye: false }];
    prismaMock.round.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        eventId: 'e1',
        status: 'in_progress',
        matches: originalMatches,
        event: { status: 'active', config: { format: 'round_robin' } },
      })
      .mockResolvedValueOnce({ id: 'r1', status: 'not_started', matches: [{ id: 'm1' }] });
    prismaMock.gameResult.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.match.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'not_started' });
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });

    await resetRound('r1');

    expect(pairingMocks.assignRoundRobinPairings).not.toHaveBeenCalled();
    expect(prismaMock.match.create).toHaveBeenCalledWith({
      data: {
        roundId: 'r1',
        player1Id: 'u1',
        player2Id: 'u2',
        isBye: false,
        status: 'pending',
        confirmedAt: null,
      },
    });
  });
});
