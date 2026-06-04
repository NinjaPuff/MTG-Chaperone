import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { ensureDeckbuilderRound } from '../../services/decklistService.js';

describe('decklistService ensureDeckbuilderRound', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('creates round one for setup swiss events with no rounds', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      status: 'setup',
      config: { format: 'swiss' },
      rounds: [],
    });
    prismaMock.round.create.mockResolvedValue({
      id: 'r1',
      roundNumber: 1,
      status: 'not_started',
    });

    const round = await ensureDeckbuilderRound('e1');

    expect(prismaMock.round.create).toHaveBeenCalledWith({
      data: {
        eventId: 'e1',
        roundNumber: 1,
        status: 'not_started',
      },
      select: {
        id: true,
        roundNumber: true,
        status: true,
      },
    });
    expect(prismaMock.match.create).not.toHaveBeenCalled();
    expect(round).toEqual({
      id: 'r1',
      roundNumber: 1,
      status: 'not_started',
    });
  });

  it('creates round one for active seeded swiss events with no rounds', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      status: 'active',
      config: { format: 'seeded_swiss' },
      rounds: [],
    });
    prismaMock.round.create.mockResolvedValue({
      id: 'r1',
      roundNumber: 1,
      status: 'not_started',
    });

    const round = await ensureDeckbuilderRound('e1');
    expect(round.id).toBe('r1');
    expect(prismaMock.round.create).toHaveBeenCalledTimes(1);
  });

  it('returns in-progress rounds first when available', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      status: 'active',
      config: { format: 'swiss' },
      rounds: [
        { id: 'r1', roundNumber: 1, status: 'completed' },
        { id: 'r2', roundNumber: 2, status: 'in_progress' },
      ],
    });

    const round = await ensureDeckbuilderRound('e1');
    expect(round).toEqual({ id: 'r2', roundNumber: 2, status: 'in_progress' });
    expect(prismaMock.round.create).not.toHaveBeenCalled();
  });

  it('returns earliest not_started round when there is no in-progress round', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      status: 'active',
      config: { format: 'swiss' },
      rounds: [
        { id: 'r1', roundNumber: 1, status: 'not_started' },
        { id: 'r2', roundNumber: 2, status: 'not_started' },
      ],
    });

    const round = await ensureDeckbuilderRound('e1');
    expect(round).toEqual({ id: 'r1', roundNumber: 1, status: 'not_started' });
  });

  it('returns last round when all rounds are completed', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      status: 'active',
      config: { format: 'swiss' },
      rounds: [{ id: 'r1', roundNumber: 1, status: 'completed' }],
    });

    const round = await ensureDeckbuilderRound('e1');
    expect(round).toEqual({ id: 'r1', roundNumber: 1, status: 'completed' });
  });

  it('throws invalid event state when the event is completed', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      status: 'completed',
      config: { format: 'swiss' },
      rounds: [],
    });

    await expect(ensureDeckbuilderRound('e1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
    });
    expect(prismaMock.round.create).not.toHaveBeenCalled();
  });

  it('throws invalid event state for round robin events without rounds', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      status: 'active',
      config: { format: 'round_robin' },
      rounds: [],
    });

    await expect(ensureDeckbuilderRound('e1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Event has no rounds yet',
    });
    expect(prismaMock.round.create).not.toHaveBeenCalled();
  });

  it('throws not found when event does not exist', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);

    await expect(ensureDeckbuilderRound('e1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Event not found',
    });
  });

});
