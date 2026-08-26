import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { submitDecklist, updateDecklist, validateDecklist } from '../../services/decklistService.js';

const EXTRA_ENTRIES = [{ cachedCardId: 'card-1', quantity: 2, zone: 'main' as const }];

function extraDeck(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deck-extra',
    userId: 'user-1',
    eventId: 'event-1',
    roundId: 'round-1',
    status: 'draft',
    orderIndex: 1,
    event: {
      season: { id: 'season-1' },
      config: {
        format: 'swiss',
        deckLockingMode: 'free_modification',
        deckCount: 1,
        minDeckSize: 40,
        sideboardRule: 'entire_pool',
      },
    },
    round: { roundNumber: 1 },
    entries: [],
    ...overrides,
  };
}

function mockPoolQty2() {
  prismaMock.cardPool.findUnique.mockResolvedValue({
    id: 'pool-1',
    acquisitions: [
      {
        entries: [{ cachedCardId: 'card-1', quantity: 2, cachedCard: { typeLine: 'Creature - Wizard' } }],
      },
    ],
  });
  prismaMock.cachedCard.findMany.mockResolvedValue([]);
}

function mockUniquenessOff() {
  prismaMock.deckUniquenessRule.findUnique.mockResolvedValue(null);
}

function mockMatches(statuses: Array<'pending' | 'confirmed' | 'resolved' | 'reported' | 'disputed'>) {
  prismaMock.match.findMany.mockResolvedValue(statuses.map((status) => ({ status })));
}

function mockRegisteredSiblingOverlap() {
  prismaMock.decklist.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        status: 'submitted',
        entries: [{ cachedCardId: 'card-1', quantity: 2 }],
      },
    ]);
}

describe('decklistService extra-draft allocation after matches complete', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('rejects extra-draft overlap with registered siblings while a match is pending', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(extraDeck());
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['pending']);
    mockRegisteredSiblingOverlap();
    prismaMock.cachedCard.findUnique.mockResolvedValue({ name: 'Card One', setCode: 'SET', collectorNumber: '1' });

    await expect(updateDecklist('deck-extra', 'user-1', false, { entries: EXTRA_ENTRIES })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/Too many copies allocated/),
    });
    expect(prismaMock.decklist.update).not.toHaveBeenCalled();
  });

  it('saves extra-draft overlap with registered siblings when all event matches are terminal', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(extraDeck());
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['confirmed', 'resolved']);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-extra', name: 'Extra', entries: [] });

    const result = await updateDecklist('deck-extra', 'user-1', false, { entries: EXTRA_ENTRIES });

    expect(result.id).toBe('deck-extra');
    expect(prismaMock.decklist.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'draft',
          orderIndex: { gte: 1 },
        }),
      }),
    );
  });

  it('still rejects extra-draft copies that exceed the pool after matches complete', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(extraDeck());
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['confirmed']);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.cachedCard.findUnique.mockResolvedValue({ name: 'Card One', setCode: 'SET', collectorNumber: '1' });

    await expect(
      updateDecklist('deck-extra', 'user-1', false, {
        entries: [{ cachedCardId: 'card-1', quantity: 3, zone: 'main' }],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/Too many copies allocated/),
    });
    expect(prismaMock.decklist.update).not.toHaveBeenCalled();
  });

  it('still rejects required-slot overlap with registered siblings after matches complete', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(
      extraDeck({
        id: 'deck-required',
        orderIndex: 0,
      }),
    );
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['confirmed']);
    mockRegisteredSiblingOverlap();
    prismaMock.cachedCard.findUnique.mockResolvedValue({ name: 'Card One', setCode: 'SET', collectorNumber: '1' });

    await expect(
      updateDecklist('deck-required', 'user-1', false, { entries: EXTRA_ENTRIES }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/Too many copies allocated/),
    });
  });

  it('rejects extra submit when registered count already equals deckCount', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(extraDeck());
    prismaMock.decklist.count.mockResolvedValue(1);
    mockMatches(['confirmed']);

    await expect(submitDecklist('deck-extra', 'user-1')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.decklist.update).not.toHaveBeenCalled();
  });

  it('allows an extra-draft save that does not worsen overlap after a new pending match appears', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(
      extraDeck({
        entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
      }),
    );
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['pending']);
    mockRegisteredSiblingOverlap();
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-extra', name: 'Extra', entries: [] });

    const result = await updateDecklist('deck-extra', 'user-1', false, { entries: EXTRA_ENTRIES });
    expect(result.id).toBe('deck-extra');
  });

  it('rejects an extra-draft save that worsens overlap after a new pending match appears', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(
      extraDeck({
        entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
      }),
    );
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['pending']);
    mockRegisteredSiblingOverlap();
    prismaMock.cachedCard.findUnique.mockResolvedValue({ name: 'Card One', setCode: 'SET', collectorNumber: '1' });

    await expect(
      updateDecklist('deck-extra', 'user-1', false, {
        entries: [{ cachedCardId: 'card-1', quantity: 3, zone: 'main' }],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/Too many copies allocated/),
    });
  });

  it('counts other extra drafts against the pool when the exemption is on', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(extraDeck());
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['confirmed']);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        status: 'draft',
        orderIndex: 2,
        entries: [{ cachedCardId: 'card-1', quantity: 2 }],
      },
    ]);
    prismaMock.cachedCard.findUnique.mockResolvedValue({ name: 'Card One', setCode: 'SET', collectorNumber: '1' });

    await expect(updateDecklist('deck-extra', 'user-1', false, { entries: EXTRA_ENTRIES })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/Too many copies allocated/),
    });
    expect(prismaMock.decklist.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'draft',
          orderIndex: { gte: 1 },
        }),
      }),
    );
    expect(prismaMock.decklist.findMany.mock.calls[1][0].where.status).not.toEqual({
      in: ['submitted', 'locked'],
    });
    expect(prismaMock.decklist.findMany.mock.calls[1][0].where.roundId).toBeUndefined();
  });

  it('omits registered-sibling allocation errors when validating an extra draft after matches complete', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(
      extraDeck({
        entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main', cachedCard: { typeLine: 'Creature - Wizard' } }],
      }),
    );
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['confirmed']);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { entries: [{ cachedCardId: 'card-1', quantity: 2 }] },
    ]);

    const result = await validateDecklist('deck-extra', 'user-1');

    expect(result.errors.some((error) => /Too many copies allocated/.test(error))).toBe(false);
    expect(prismaMock.decklist.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { id: 'deck-extra' },
            expect.objectContaining({
              status: 'draft',
              orderIndex: { gte: 1 },
            }),
          ]),
        }),
      }),
    );
    const siblingWhere = prismaMock.decklist.findMany.mock.calls[1][0].where;
    expect(JSON.stringify(siblingWhere)).not.toContain('submitted');
  });

  it('uses the deck owner id when an admin updates another user extra deck', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(extraDeck());
    mockPoolQty2();
    mockUniquenessOff();
    mockMatches(['confirmed']);
    prismaMock.decklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-extra', name: 'Extra', entries: [] });

    const result = await updateDecklist('deck-extra', 'admin-1', true, { entries: EXTRA_ENTRIES });

    expect(result.id).toBe('deck-extra');
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          round: { eventId: 'event-1' },
          OR: [{ player1Id: 'user-1' }, { player2Id: 'user-1' }],
        }),
      }),
    );
    expect(prismaMock.match.findMany.mock.calls[0][0].where.OR).not.toEqual([
      { player1Id: 'admin-1' },
      { player2Id: 'admin-1' },
    ]);
  });

  it('allows extra-draft copies that uniqueness would restrict after matches complete', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(
      extraDeck({
        round: { roundNumber: 2 },
      }),
    );
    mockPoolQty2();
    prismaMock.deckUniquenessRule.findUnique.mockResolvedValue({
      constraintType: 'no_repeat_previous',
      parameters: {},
    });
    mockMatches(['confirmed']);
    prismaMock.decklist.findMany.mockResolvedValueOnce([
      {
        orderIndex: 0,
        round: { roundNumber: 1 },
        entries: [
          {
            cachedCardId: 'card-1',
            quantity: 2,
            cachedCard: { typeLine: 'Creature - Wizard' },
          },
        ],
      },
    ]).mockResolvedValueOnce([]);
    prismaMock.decklist.update.mockResolvedValue({ id: 'deck-extra', name: 'Extra', entries: [] });

    const result = await updateDecklist('deck-extra', 'user-1', false, { entries: EXTRA_ENTRIES });
    expect(result.id).toBe('deck-extra');
  });
});
