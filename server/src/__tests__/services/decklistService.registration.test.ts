import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import {
  createDecklist,
  deleteDecklist,
  listMyDecklistsForRound,
  submitDecklist,
  unsubmitDecklist,
  updateDecklist,
} from '../../services/decklistService.js';

function mockEventRoundContext() {
  prismaMock.event.findUnique.mockResolvedValue({
    id: 'event-1',
    config: { deckCount: 2, format: 'swiss', deckLockingMode: 'free_modification' },
    deckUniquenessRule: null,
    season: { id: 'season-1' },
    rounds: [{ id: 'round-1', roundNumber: 2 }],
  });
}

function mockUserPool() {
  prismaMock.cardPool.findUnique.mockResolvedValue({
    id: 'pool-1',
    acquisitions: [
      {
        entries: [{ cachedCardId: 'card-1', quantity: 4, cachedCard: { typeLine: 'Creature - Wizard' } }],
      },
    ],
  });
  prismaMock.cachedCard.findMany.mockResolvedValue([]);
}

describe('decklistService registration behaviors', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('auto-assigns next orderIndex when omitted', async () => {
    mockEventRoundContext();
    mockUserPool();
    prismaMock.decklist.findFirst
      .mockResolvedValueOnce({ orderIndex: 2 })
      .mockResolvedValueOnce(null);
    prismaMock.decklist.create.mockResolvedValue({ id: 'deck-3', orderIndex: 3, entries: [] });

    await createDecklist({
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      name: 'Deck 4',
    });

    expect(prismaMock.decklist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderIndex: 3,
        }),
      }),
    );
  });

  it('enforces registration cap when submitting', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { config: { deckCount: 2, deckLockingMode: 'free_modification' } },
    });
    prismaMock.decklist.count.mockResolvedValue(2);

    await expect(submitDecklist('deck-1', 'user-1')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.decklist.update).not.toHaveBeenCalled();
  });

  it('blocks unsubmit after match played in swiss', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'submitted',
      event: { config: { format: 'swiss' } },
    });
    prismaMock.match.findFirst.mockResolvedValue({ id: 'm1' });

    await expect(unsubmitDecklist('deck-1', 'user-1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
    });
  });

  it('allows unsubmit in round robin even when matches are reported', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'submitted',
      event: { config: { format: 'round_robin' } },
    });
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-1', status: 'draft' });

    const result = await unsubmitDecklist('deck-1', 'user-1');

    expect(prismaMock.match.findFirst).not.toHaveBeenCalled();
    expect(result.status).toBe('draft');
  });

  it('rejects deleting required deck slots', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      orderIndex: 0,
      status: 'draft',
      event: { config: { deckCount: 1 } },
    });

    await expect(deleteDecklist('deck-1', 'user-1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
    });
    expect(prismaMock.decklist.delete).not.toHaveBeenCalled();
  });

  it('returns registeredCount in my decklists payload', async () => {
    mockEventRoundContext();
    mockUserPool();
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([
        { id: 'd1', orderIndex: 0, status: 'submitted', entries: [] },
        { id: 'd2', orderIndex: 1, status: 'locked', entries: [] },
        { id: 'd3', orderIndex: 2, status: 'draft', entries: [] },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForRound('event-1', 'round-1', 'user-1');

    expect(response.registeredCount).toBe(2);
  });

  it('allows name-only updates for submitted swiss decks but blocks content edits', async () => {
    prismaMock.decklist.findUnique
      .mockResolvedValueOnce({
        id: 'deck-1',
        userId: 'user-1',
        eventId: 'event-1',
        roundId: 'round-1',
        status: 'submitted',
        event: { season: { id: 'season-1' }, config: { format: 'swiss', deckLockingMode: 'free_modification' } },
        round: { roundNumber: 1 },
        entries: [],
      })
      .mockResolvedValueOnce({
        id: 'deck-1',
        userId: 'user-1',
        eventId: 'event-1',
        roundId: 'round-1',
        status: 'submitted',
        event: { season: { id: 'season-1' }, config: { format: 'swiss', deckLockingMode: 'free_modification' } },
        round: { roundNumber: 1 },
        entries: [],
      });
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-1', name: 'Renamed', entries: [] });

    const renamed = await updateDecklist('deck-1', 'user-1', false, { name: 'Renamed' });
    expect(renamed.name).toBe('Renamed');
    expect(prismaMock.decklistEntry.deleteMany).not.toHaveBeenCalled();

    await expect(
      updateDecklist('deck-1', 'user-1', false, {
        entries: [{ cachedCardId: 'card-1', quantity: 1, zone: 'main' }],
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Decklist contents cannot be edited',
    });
  });

  it('allows name-only updates for locked decks', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'locked',
      event: { season: { id: 'season-1' }, config: { format: 'swiss', deckLockingMode: 'free_modification' } },
      round: { roundNumber: 1 },
      entries: [],
    });
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-1', name: 'Locked Rename', entries: [] });

    const result = await updateDecklist('deck-1', 'user-1', false, { name: 'Locked Rename' });
    expect(result.name).toBe('Locked Rename');
  });

  it('allows full edits for submitted round robin decks', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-2',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'submitted',
      event: { season: { id: 'season-1' }, config: { format: 'round_robin', deckLockingMode: 'free_modification' } },
      round: { roundNumber: 1 },
      entries: [],
    });
    mockUserPool();
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValue([]);
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-2', name: 'Updated', entries: [] });

    const result = await updateDecklist('deck-2', 'user-1', false, { name: 'Updated' });
    expect(result.id).toBe('deck-2');
  });
});
