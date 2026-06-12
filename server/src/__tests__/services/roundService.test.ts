import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

const pairingMocks = vi.hoisted(() => ({
  assignRoundRobinPairings: vi.fn(),
  generateRoundRobinSchedule: vi.fn(),
  generateSeededSwissPairings: vi.fn(),
  generateSwissPairings: vi.fn(),
  regeneratePairings: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../services/pairingService.js', () => pairingMocks);

import { completeRound, createRound, deleteRound, startRound } from '../../services/roundService.js';

describe('roundService', () => {
  beforeEach(() => {
    resetPrismaMock();
    pairingMocks.assignRoundRobinPairings.mockReset();
    pairingMocks.generateRoundRobinSchedule.mockReset();
    pairingMocks.generateSeededSwissPairings.mockReset();
    pairingMocks.generateSwissPairings.mockReset();
    pairingMocks.regeneratePairings.mockReset();
  });

  it('starts a round from not_started state', async () => {
    prismaMock.round.findUnique.mockResolvedValue({ id: 'r1', status: 'not_started', event: { status: 'active' } });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'in_progress' });

    const result = await startRound('r1');

    expect(result.status).toBe('in_progress');
    expect(prismaMock.round.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'in_progress' },
    });
    expect(prismaMock.round.findUnique).toHaveBeenCalledWith({
      where: { id: 'r1' },
      include: { event: { select: { status: true } } },
    });
  });

  it('blocks starting rounds when event is not active', async () => {
    prismaMock.round.findUnique.mockResolvedValue({ id: 'r1', status: 'not_started', event: { status: 'setup' } });

    await expect(startRound('r1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Event must be active before starting rounds',
    });
    expect(prismaMock.round.update).not.toHaveBeenCalled();
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
      eventId: 'e1',
      status: 'in_progress',
      matches: [{ status: 'reported' }, { status: 'confirmed' }],
      event: { config: { format: 'swiss' } },
    });
    prismaMock.match.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 2 });
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
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: {
        roundId: 'r1',
        status: { in: ['draft', 'submitted'] },
      },
      data: { status: 'locked' },
    });
  });

  it('does not lock decklists when completing a round robin round', async () => {
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      eventId: 'e1',
      status: 'in_progress',
      matches: [{ status: 'reported' }, { status: 'confirmed' }],
      event: { config: { format: 'round_robin' } },
    });
    prismaMock.match.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.round.update.mockResolvedValue({ id: 'r1', status: 'completed' });

    await completeRound('r1');

    expect(prismaMock.decklist.updateMany).not.toHaveBeenCalled();
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

  it('pairs existing empty not_started round before creating a new one', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      totalRounds: 3,
      config: { format: 'swiss' },
      rounds: [{ roundNumber: 1 }],
      season: { league: { memberships: [{ userId: 'u1' }, { userId: 'u2' }] } },
    });
    prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', roundNumber: 1, status: 'not_started' });
    pairingMocks.generateSwissPairings.mockResolvedValue([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });
    prismaMock.round.findUnique.mockResolvedValue({ id: 'r1', matches: [{ id: 'm1' }] });

    const result = await createRound('e1');

    expect(prismaMock.round.create).not.toHaveBeenCalled();
    expect(prismaMock.round.findMany).not.toHaveBeenCalled();
    expect(pairingMocks.generateSwissPairings).toHaveBeenCalledWith('r1');
    expect(result).toEqual({ id: 'r1', matches: [{ id: 'm1' }] });
  });

  it('skips max round check when pairing an existing shell', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      totalRounds: 1,
      config: { format: 'swiss' },
      rounds: [{ roundNumber: 1 }],
      season: { league: { memberships: [{ userId: 'u1' }, { userId: 'u2' }] } },
    });
    prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', roundNumber: 1, status: 'not_started' });
    pairingMocks.generateSwissPairings.mockResolvedValue([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });
    prismaMock.round.findUnique.mockResolvedValue({ id: 'r1', matches: [{ id: 'm1' }] });

    await expect(createRound('e1')).resolves.toMatchObject({ id: 'r1' });
    expect(prismaMock.round.findMany).not.toHaveBeenCalled();
  });

  it('creates a new round when no empty shell exists', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      totalRounds: 3,
      config: { format: 'swiss' },
      rounds: [{ roundNumber: 1 }],
      season: { league: { memberships: [{ userId: 'u1' }, { userId: 'u2' }] } },
    });
    prismaMock.round.findFirst.mockResolvedValue(null);
    prismaMock.round.findMany.mockResolvedValue([{ id: 'r1' }]);
    prismaMock.round.create.mockResolvedValue({ id: 'r2', roundNumber: 2 });
    pairingMocks.generateSwissPairings.mockResolvedValue([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });
    prismaMock.round.findUnique.mockResolvedValue({ id: 'r2', matches: [{ id: 'm1' }] });

    const result = await createRound('e1');

    expect(prismaMock.round.create).toHaveBeenCalledWith({
      data: {
        eventId: 'e1',
        roundNumber: 2,
        status: 'not_started',
      },
    });
    expect(result).toEqual({ id: 'r2', matches: [{ id: 'm1' }] });
  });
});
