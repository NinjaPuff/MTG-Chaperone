import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import {
  createDecklist,
  deleteDecklist,
  listMyDecklistsForEvent,
  listMyDecklistsForRound,
  submitDecklist,
  unsubmitDecklist,
  validateDecklist,
  updateDecklist,
} from '../../services/decklistService.js';

function mockEventRoundContext(options?: { eventId?: string; roundId?: string; roundNumber?: number; deckCount?: number }) {
  const eventId = options?.eventId ?? 'event-1';
  const roundId = options?.roundId ?? 'round-1';
  prismaMock.event.findUnique.mockResolvedValue({
    id: eventId,
    orderIndex: 2,
    config: { deckCount: options?.deckCount ?? 2, format: 'swiss', deckLockingMode: 'free_modification' },
    deckUniquenessRule: null,
    season: { id: 'season-1' },
    rounds: [{ id: roundId, roundNumber: options?.roundNumber ?? 2 }],
  });
}

function mockWeek2ForEventList(options?: { deckCount?: number }) {
  const deckCount = options?.deckCount ?? 2;
  prismaMock.event.findUnique
    .mockResolvedValueOnce({
      status: 'active',
      config: { format: 'swiss' },
      rounds: [
        { id: 'round-1', roundNumber: 1, status: 'completed' },
        { id: 'round-2', roundNumber: 2, status: 'in_progress' },
      ],
    })
    .mockResolvedValue({
      id: 'week-2',
      orderIndex: 2,
      status: 'active',
      config: { deckCount, format: 'swiss', deckLockingMode: 'free_modification' },
      deckUniquenessRule: null,
      season: { id: 'season-1' },
      rounds: [{ id: 'round-2', roundNumber: 2 }],
    });
  prismaMock.event.findFirst.mockResolvedValue(null);
}

const aliceReq0 = {
  id: 'alice-req-0',
  orderIndex: 0,
  status: 'submitted' as const,
  entries: [{ cachedCardId: 'card-shock', quantity: 1 }],
};
const aliceReq1 = {
  id: 'alice-req-1',
  orderIndex: 1,
  status: 'locked' as const,
  entries: [{ cachedCardId: 'card-bolt', quantity: 1 }],
};
const aliceExtra2 = {
  id: 'alice-extra-2',
  orderIndex: 2,
  status: 'draft' as const,
  entries: [{ cachedCardId: 'card-distinctive', quantity: 2 }],
};

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
    expect(prismaMock.decklist.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          userId: 'user-1',
          eventId: 'event-1',
        },
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
      message: 'Already registered 2 deck(s) for this event. Unregister one first.',
    });
    expect(prismaMock.decklist.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          eventId: 'event-1',
          status: { in: ['submitted', 'locked'] },
        }),
      }),
    );
    expect(prismaMock.decklist.count.mock.calls[0][0].where.roundId).toBeUndefined();
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
    expect(prismaMock.match.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'pending' },
          OR: [{ player1Id: 'user-1' }, { player2Id: 'user-1' }],
          round: { eventId: 'event-1' },
        }),
      }),
    );
    expect(prismaMock.match.findFirst.mock.calls[0][0].where.roundId).toBeUndefined();
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

  it('deletes an orderIndex 0 draft when another decklist exists', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      orderIndex: 0,
      status: 'draft',
      event: { id: 'event-1', config: { deckCount: 1 } },
    });
    prismaMock.decklist.count.mockResolvedValue(2);
    prismaMock.decklist.delete.mockResolvedValue({ id: 'deck-1' });

    await deleteDecklist('deck-1', 'user-1');

    expect(prismaMock.decklist.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', eventId: 'event-1' },
    });
    expect(prismaMock.decklist.delete).toHaveBeenCalledWith({
      where: { id: 'deck-1' },
    });
  });

  it('rejects deleting the last remaining draft', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      orderIndex: 0,
      status: 'draft',
      event: { id: 'event-1', config: { deckCount: 1 } },
    });
    prismaMock.decklist.count.mockResolvedValue(1);

    await expect(deleteDecklist('deck-1', 'user-1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Cannot delete the last deck for this event',
    });
    expect(prismaMock.decklist.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting a submitted list even when it is the last remaining', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      orderIndex: 0,
      status: 'submitted',
      event: { id: 'event-1', config: { deckCount: 1 } },
    });

    await expect(deleteDecklist('deck-1', 'user-1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Only draft decklists can be deleted',
    });
    expect(prismaMock.decklist.count).not.toHaveBeenCalled();
    expect(prismaMock.decklist.delete).not.toHaveBeenCalled();
  });

  it('returns registeredCount in my decklists payload', async () => {
    mockWeek2ForEventList();
    mockUserPool();
    prismaMock.decklist.findMany.mockResolvedValue([aliceReq0, aliceReq1, aliceExtra2]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForEvent('week-2', 'alice');

    expect(response.registeredCount).toBe(2);
    expect(response.roundId).toBe('round-2');
    expect(response.matchesComplete).toBe(false);
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          round: { eventId: 'week-2' },
          OR: [{ player1Id: 'alice' }, { player2Id: 'alice' }],
        }),
      }),
    );
  });

  it('sets matchesComplete true when every event match is terminal', async () => {
    mockEventRoundContext();
    mockUserPool();
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValue([
      { id: 'd1', orderIndex: 0, status: 'draft', entries: [] },
      { id: 'd2', orderIndex: 1, status: 'draft', entries: [] },
    ]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.match.findMany.mockResolvedValue([{ status: 'confirmed' }, { status: 'resolved' }]);

    const response = await listMyDecklistsForRound('event-1', 'round-1', 'user-1');

    expect(response.matchesComplete).toBe(true);
  });

  it('sets matchesComplete false when a not_started round still has a pending match', async () => {
    mockEventRoundContext();
    mockUserPool();
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValue([
      { id: 'd1', orderIndex: 0, status: 'draft', entries: [] },
      { id: 'd2', orderIndex: 1, status: 'draft', entries: [] },
    ]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.match.findMany.mockResolvedValue([{ status: 'confirmed' }, { status: 'pending' }]);

    const response = await listMyDecklistsForRound('event-1', 'round-1', 'user-1');

    expect(response.matchesComplete).toBe(false);
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

  it('ignores draft sibling overlap when updating a draft decklist', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-2',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { season: { id: 'season-1' }, config: { format: 'swiss', deckLockingMode: 'free_modification' } },
      round: { roundNumber: 1 },
      entries: [],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 2, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.cachedCard.findMany.mockResolvedValue([]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-2', name: 'Updated', entries: [] });

    const result = await updateDecklist('deck-2', 'user-1', false, {
      entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main' }],
    });

    expect(result.id).toBe('deck-2');
    expect(prismaMock.decklist.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          eventId: 'event-1',
          status: { in: ['submitted', 'locked'] },
        }),
      }),
    );
    expect(prismaMock.decklist.findMany.mock.calls[1][0].where.roundId).toBeUndefined();
  });

  it('blocks update when a registered sibling would over-allocate copies', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-2',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { season: { id: 'season-1' }, config: { format: 'swiss', deckLockingMode: 'free_modification' } },
      round: { roundNumber: 1 },
      entries: [],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 2, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.cachedCard.findMany.mockResolvedValue([]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          status: 'submitted',
          entries: [{ cachedCardId: 'card-1', quantity: 2 }],
        },
      ]);
    prismaMock.cachedCard.findUnique.mockResolvedValue({ name: 'Card One', setCode: 'SET', collectorNumber: '1' });

    await expect(
      updateDecklist('deck-2', 'user-1', false, {
        entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main' }],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fields: { cachedCardId: 'card-1' },
    });
  });

  it('validates against registered siblings only for allocation checks', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { config: { minDeckSize: 2, sideboardRule: 'entire_pool' }, season: { id: 'season-1' } },
      round: { roundNumber: 1 },
      entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 2, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { entries: [{ cachedCardId: 'card-1', quantity: 2 }] },
      ]);
    prismaMock.cachedCard.findMany.mockResolvedValue([]);

    const validResult = await validateDecklist('deck-1', 'user-1');
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toEqual([]);

    expect(prismaMock.decklist.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { id: 'deck-1' },
            { status: { in: ['submitted', 'locked'] } },
          ],
        }),
      }),
    );
  });

  it('marks validation invalid when registered allocations exceed pool copies', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { config: { minDeckSize: 40, sideboardRule: 'entire_pool' }, season: { id: 'season-1' } },
      round: { roundNumber: 1 },
      entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 2, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { entries: [{ cachedCardId: 'card-1', quantity: 4 }] },
      ]);
    prismaMock.cachedCard.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ scryfallId: 'card-1', name: 'Card One', setCode: 'SET', collectorNumber: '1' }]);

    const invalidResult = await validateDecklist('deck-1', 'user-1');

    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors[0]).toContain('Too many copies allocated');
    expect(invalidResult.invalidCardIds).toContain('card-1');
  });

  it('returns a validation error when main deck is below minimum size', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { config: { minDeckSize: 40, sideboardRule: 'entire_pool' }, season: { id: 'season-1' } },
      round: { roundNumber: 1 },
      entries: [{ cachedCardId: 'card-1', quantity: 39, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 40, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ entries: [{ cachedCardId: 'card-1', quantity: 1 }] }]);
    prismaMock.cachedCard.findMany.mockResolvedValue([]);

    const result = await validateDecklist('deck-1', 'user-1');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Main deck is below minimum size (39/40)');
    expect(result.warnings).not.toContain('Main deck is below minimum size (39/40)');
  });

  it('should_put_size_shortfall_in_errors_when_main_is_empty', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { config: { minDeckSize: 40, sideboardRule: 'entire_pool' }, season: { id: 'season-1' } },
      round: { roundNumber: 1 },
      entries: [],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 40, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.cachedCard.findMany.mockResolvedValue([]);

    const result = await validateDecklist('deck-1', 'user-1');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Main deck is below minimum size (0/40)');
  });

  it('should_be_valid_when_main_meets_minDeckSize_and_allocation_ok', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { config: { minDeckSize: 40, sideboardRule: 'entire_pool' }, season: { id: 'season-1' } },
      round: { roundNumber: 1 },
      entries: [{ cachedCardId: 'card-1', quantity: 40, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 40, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.cachedCard.findMany.mockResolvedValue([]);

    const result = await validateDecklist('deck-1', 'user-1');

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should_keep_sideboard_count_as_warning_when_fixed_15_mismatches', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-1',
      roundId: 'round-1',
      status: 'draft',
      event: { config: { minDeckSize: 40, sideboardRule: 'fixed_15' }, season: { id: 'season-1' } },
      round: { roundNumber: 1 },
      entries: [
        { cachedCardId: 'card-1', quantity: 40, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } },
        { cachedCardId: 'card-2', quantity: 14, zone: 'sideboard', cachedCard: { typeLine: 'Instant' } },
      ],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [
            { cachedCardId: 'card-1', quantity: 40, cachedCard: { typeLine: 'Creature - Wizard' } },
            { cachedCardId: 'card-2', quantity: 14, cachedCard: { typeLine: 'Instant' } },
          ],
        },
      ],
    });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.cachedCard.findMany.mockResolvedValue([]);

    const result = await validateDecklist('deck-1', 'user-1');

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('Sideboard count is 14; expected 15');
    expect(result.errors).not.toContain('Sideboard count is 14; expected 15');
  });

  it('applies minimum-changes warnings using only registered prior-event decks', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue({
      id: 'deck-1',
      userId: 'user-1',
      eventId: 'event-2',
      roundId: 'round-1',
      orderIndex: 0,
      status: 'draft',
      event: {
        orderIndex: 2,
        config: { minDeckSize: 40, sideboardRule: 'entire_pool' },
        season: { id: 'season-1' },
      },
      round: { roundNumber: 1 },
      entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
    });
    prismaMock.cardPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      acquisitions: [
        {
          entries: [{ cachedCardId: 'card-1', quantity: 4, cachedCard: { typeLine: 'Creature - Wizard' } }],
        },
      ],
    });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue({
      constraintType: 'minimum_changes',
      parameters: { minChanges: 1 },
    });
    prismaMock.cachedCard.findMany.mockResolvedValue([]);

    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ entries: [{ cachedCardId: 'card-1', quantity: 2 }] }]);
    const withoutRegisteredPrior = await validateDecklist('deck-1', 'user-1');
    expect(withoutRegisteredPrior.warnings.some((warning) => warning.includes('more non-basic card changes required'))).toBe(false);

    prismaMock.decklist.findMany.mockReset();
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([
        {
          orderIndex: 0,
          round: { roundNumber: 1 },
          event: { orderIndex: 1 },
          entries: [
            {
              cachedCardId: 'card-1',
              quantity: 2,
              cachedCard: { typeLine: 'Creature - Wizard' },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([{ entries: [{ cachedCardId: 'card-1', quantity: 2 }] }]);

    const withRegisteredPrior = await validateDecklist('deck-1', 'user-1');
    expect(withRegisteredPrior.warnings).toContain('1 more non-basic card changes required from previous round');
    expect(prismaMock.decklist.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: { in: ['submitted', 'locked'] },
          event: expect.objectContaining({
            seasonId: 'season-1',
            status: 'completed',
            orderIndex: { lt: 2 },
          }),
        }),
      }),
    );
    expect(prismaMock.decklist.findMany.mock.calls[0][0].where.eventId).toBeUndefined();
    expect(prismaMock.decklist.findMany.mock.calls[0][0].where.round).toBeUndefined();
  });

  it('lists event required rows and same-event extras after round 2 starts without minting or moving', async () => {
    mockWeek2ForEventList();
    mockUserPool();
    prismaMock.decklist.findMany.mockResolvedValue([aliceReq0, aliceReq1, aliceExtra2]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForEvent('week-2', 'alice');

    expect(prismaMock.decklist.createMany).not.toHaveBeenCalled();
    expect(prismaMock.decklist.updateMany).not.toHaveBeenCalled();
    expect(response.roundId).toBe('round-2');
    expect(response.decklists.map((decklist) => decklist.id)).toEqual([
      'alice-req-0',
      'alice-req-1',
      'alice-extra-2',
    ]);
    expect(response.decklists[0].status).toBe('submitted');
    expect(response.decklists[1].status).toBe('locked');
    expect(response.decklists[2].entries).toEqual([{ cachedCardId: 'card-distinctive', quantity: 2 }]);
  });

  it('listMyDecklistsForRound returns the same event ids without minting', async () => {
    mockEventRoundContext({ eventId: 'week-2', roundId: 'round-2', roundNumber: 2, deckCount: 2 });
    mockUserPool();
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValue([aliceReq0, aliceReq1, aliceExtra2]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForRound('week-2', 'round-2', 'alice');

    expect(prismaMock.decklist.createMany).not.toHaveBeenCalled();
    expect(response.decklists.map((decklist) => decklist.id)).toEqual([
      'alice-req-0',
      'alice-req-1',
      'alice-extra-2',
    ]);
  });

  it('does not mint required slots when they already exist on the event under another roundId', async () => {
    mockWeek2ForEventList();
    mockUserPool();
    prismaMock.decklist.findMany.mockResolvedValue([
      { ...aliceReq0, roundId: 'round-1' },
      { ...aliceReq1, roundId: 'round-1' },
    ]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForEvent('week-2', 'alice');

    expect(prismaMock.decklist.createMany).not.toHaveBeenCalled();
    expect(response.decklists.map((decklist) => decklist.id)).toEqual(['alice-req-0', 'alice-req-1']);
  });

  it('mints one starter draft when the event has no rows even if deckCount is 2', async () => {
    mockWeek2ForEventList();
    mockUserPool();
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'minted-0', orderIndex: 0, status: 'draft', entries: [] }]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForEvent('week-2', 'alice');

    expect(prismaMock.decklist.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'alice', eventId: 'week-2', roundId: 'round-2', orderIndex: 0, name: 'Deck 1' }],
    });
    expect(response.decklists.map((decklist) => decklist.orderIndex)).toEqual([0]);
  });

  it('does not remint slot 0 when the player already has an extra and no required seat', async () => {
    mockWeek2ForEventList({ deckCount: 1 });
    mockUserPool();
    prismaMock.decklist.findMany.mockResolvedValue([
      { id: 'extra-1', orderIndex: 1, status: 'draft', entries: [] },
    ]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    await listMyDecklistsForEvent('week-2', 'alice');

    expect(prismaMock.decklist.createMany).not.toHaveBeenCalled();
  });

  it('keeps an unregistered required draft across round 2 without replacing it', async () => {
    mockWeek2ForEventList();
    mockUserPool();
    const draftRequired = {
      id: 'alice-req-0',
      orderIndex: 0,
      status: 'draft' as const,
      entries: [{ cachedCardId: 'card-kept', quantity: 3 }],
    };
    prismaMock.decklist.findMany.mockResolvedValue([draftRequired, aliceReq1]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForEvent('week-2', 'alice');

    expect(prismaMock.decklist.createMany).not.toHaveBeenCalled();
    expect(response.decklists[0]).toMatchObject({
      id: 'alice-req-0',
      status: 'draft',
      entries: [{ cachedCardId: 'card-kept', quantity: 3 }],
    });
  });

  it('rejects createDecklist when the event slot is already taken', async () => {
    mockEventRoundContext({ eventId: 'week-2', roundId: 'round-2' });
    mockUserPool();
    prismaMock.decklist.findFirst.mockResolvedValue({ id: 'existing-on-round-1' });

    await expect(
      createDecklist({
        userId: 'alice',
        eventId: 'week-2',
        roundId: 'round-2',
        orderIndex: 0,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Decklist already exists for this event and slot',
    });
    expect(prismaMock.decklist.create).not.toHaveBeenCalled();
    expect(prismaMock.decklist.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'alice',
          eventId: 'week-2',
          orderIndex: 0,
        },
      }),
    );
  });

  it('moves extra drafts from the previous completed event onto the current event', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-2',
      orderIndex: 2,
      config: { deckCount: 1, format: 'swiss', deckLockingMode: 'free_modification' },
      deckUniquenessRule: null,
      season: { id: 'season-1' },
      rounds: [{ id: 'round-1', roundNumber: 1 }],
    });
    mockUserPool();
    const requiredOnNewEvent = { id: 'd-required', orderIndex: 0, status: 'draft', entries: [] };
    const extraFromPreviousEvent = {
      id: 'd-extra',
      orderIndex: 1,
      status: 'draft',
      round: { roundNumber: 1 },
      entries: [{ cachedCardId: 'card-1', quantity: 2 }],
    };
    prismaMock.event.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([requiredOnNewEvent])
      .mockResolvedValueOnce([extraFromPreviousEvent])
      .mockResolvedValueOnce([requiredOnNewEvent, extraFromPreviousEvent]);
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForRound('event-2', 'round-1', 'user-1');

    expect(prismaMock.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: 'season-1',
          status: 'completed',
          orderIndex: { lt: 2 },
        }),
      }),
    );
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['d-extra'] } },
      data: { eventId: 'event-2', roundId: 'round-1' },
    });
    expect(response.decklists.map((decklist) => decklist.id)).toEqual(['d-required', 'd-extra']);
  });

  it('does not move extras from a previous event that is still open', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-2',
      orderIndex: 2,
      config: { deckCount: 1, format: 'swiss', deckLockingMode: 'free_modification' },
      deckUniquenessRule: null,
      season: { id: 'season-1' },
      rounds: [{ id: 'round-1', roundNumber: 1 }],
    });
    mockUserPool();
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.decklist.findMany.mockResolvedValue([
      { id: 'd-required', orderIndex: 0, status: 'draft', entries: [] },
    ]);
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    await listMyDecklistsForRound('event-2', 'round-1', 'user-1');

    expect(prismaMock.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'completed',
        }),
      }),
    );
    expect(prismaMock.decklist.updateMany).not.toHaveBeenCalled();
  });

  it('carries a leftover extra onto an empty event and does not mint slot 0', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-2',
      orderIndex: 2,
      config: { deckCount: 1, format: 'swiss', deckLockingMode: 'free_modification' },
      deckUniquenessRule: null,
      season: { id: 'season-1' },
      rounds: [{ id: 'round-1', roundNumber: 1 }],
    });
    mockUserPool();
    const extraFromPreviousEvent = {
      id: 'd-extra',
      orderIndex: 1,
      status: 'draft' as const,
      round: { roundNumber: 1 },
      entries: [],
    };
    prismaMock.event.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([extraFromPreviousEvent])
      .mockResolvedValueOnce([{ id: 'd-extra', orderIndex: 1, status: 'draft', entries: [] }]);
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForRound('event-2', 'round-1', 'user-1');

    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['d-extra'] } },
      data: { eventId: 'event-2', roundId: 'round-1' },
    });
    expect(prismaMock.decklist.createMany).not.toHaveBeenCalled();
    expect(response.decklists.map((decklist) => decklist.id)).toEqual(['d-extra']);
  });

  it('carries a leftover slot 0 draft onto an empty event and does not mint', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-2',
      orderIndex: 2,
      config: { deckCount: 1, format: 'swiss', deckLockingMode: 'free_modification' },
      deckUniquenessRule: null,
      season: { id: 'season-1' },
      rounds: [{ id: 'round-1', roundNumber: 1 }],
    });
    mockUserPool();
    const leftoverSlot0 = {
      id: 'd-old-0',
      orderIndex: 0,
      status: 'draft' as const,
      round: { roundNumber: 1 },
      entries: [],
    };
    prismaMock.event.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaMock.decklist.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([leftoverSlot0])
      .mockResolvedValueOnce([{ id: 'd-old-0', orderIndex: 0, status: 'draft', entries: [] }]);
    prismaMock.decklist.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);

    const response = await listMyDecklistsForRound('event-2', 'round-1', 'user-1');

    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['d-old-0'] } },
      data: { eventId: 'event-2', roundId: 'round-1' },
    });
    expect(prismaMock.decklist.createMany).not.toHaveBeenCalled();
    expect(response.decklists.map((decklist) => decklist.id)).toEqual(['d-old-0']);
  });
});
