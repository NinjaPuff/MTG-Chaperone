import { describe, expect, it } from 'vitest';
import {
  buildPoolAllocationMaps,
  isExtraDeckSlot,
  isRegisteredDecklistStatus,
  shouldIgnoreRegisteredAllocation,
  type DeckAllocationDeck,
} from '../decklistAllocation.js';

function makeDeck(overrides: Partial<DeckAllocationDeck>): DeckAllocationDeck {
  return {
    id: overrides.id ?? 'deck-1',
    status: overrides.status ?? 'draft',
    cards: overrides.cards ?? [],
    orderIndex: overrides.orderIndex,
  };
}

describe('decklistAllocation', () => {
  it('returns true only for submitted or locked statuses', () => {
    expect(isRegisteredDecklistStatus('draft')).toBe(false);
    expect(isRegisteredDecklistStatus('submitted')).toBe(true);
    expect(isRegisteredDecklistStatus('locked')).toBe(true);
  });

  it('counts active draft deck cards in availability', () => {
    const result = buildPoolAllocationMaps(
      [
        makeDeck({
          id: 'active',
          status: 'draft',
          cards: [{ cachedCardId: 'card-a', quantity: 2 }],
        }),
      ],
      'active',
    );

    expect(result.combinedForAvailability.get('card-a')).toBe(2);
    expect(result.activeDeckByCardId.get('card-a')).toBe(2);
    expect(result.registeredOtherDecksByCardId.get('card-a')).toBeUndefined();
  });

  it('ignores draft sibling decks for shared allocation', () => {
    const result = buildPoolAllocationMaps(
      [
        makeDeck({
          id: 'deck-a',
          status: 'draft',
          cards: [{ cachedCardId: 'card-a', quantity: 2 }],
        }),
        makeDeck({
          id: 'deck-b',
          status: 'draft',
          cards: [{ cachedCardId: 'card-a', quantity: 1 }],
        }),
      ],
      'deck-b',
    );

    expect(result.combinedForAvailability.get('card-a')).toBe(1);
    expect(result.activeDeckByCardId.get('card-a')).toBe(1);
    expect(result.registeredOtherDecksByCardId.get('card-a')).toBeUndefined();
  });

  it('counts submitted sibling decks as reserved copies', () => {
    const result = buildPoolAllocationMaps(
      [
        makeDeck({
          id: 'deck-a',
          status: 'submitted',
          cards: [{ cachedCardId: 'card-a', quantity: 2 }],
        }),
        makeDeck({
          id: 'deck-b',
          status: 'draft',
          cards: [{ cachedCardId: 'card-a', quantity: 1 }],
        }),
      ],
      'deck-b',
    );

    expect(result.combinedForAvailability.get('card-a')).toBe(3);
    expect(result.activeDeckByCardId.get('card-a')).toBe(1);
    expect(result.registeredOtherDecksByCardId.get('card-a')).toBe(2);
  });

  it('counts locked sibling decks as reserved copies', () => {
    const result = buildPoolAllocationMaps(
      [
        makeDeck({
          id: 'deck-a',
          status: 'locked',
          cards: [{ cachedCardId: 'card-a', quantity: 1 }],
        }),
        makeDeck({
          id: 'deck-b',
          status: 'draft',
          cards: [],
        }),
      ],
      'deck-b',
    );

    expect(result.combinedForAvailability.get('card-a')).toBe(1);
    expect(result.activeDeckByCardId.get('card-a')).toBeUndefined();
    expect(result.registeredOtherDecksByCardId.get('card-a')).toBe(1);
  });

  it('identifies extra slots at or above required deck count', () => {
    expect(isExtraDeckSlot(0, 1)).toBe(false);
    expect(isExtraDeckSlot(1, 1)).toBe(true);
    expect(isExtraDeckSlot(1, 2)).toBe(false);
    expect(isExtraDeckSlot(2, 2)).toBe(true);
  });

  it('ignores registered siblings only for extra drafts when matches are complete', () => {
    expect(
      shouldIgnoreRegisteredAllocation({
        matchesComplete: true,
        status: 'draft',
        orderIndex: 1,
        deckCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldIgnoreRegisteredAllocation({
        matchesComplete: true,
        status: 'draft',
        orderIndex: 0,
        deckCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldIgnoreRegisteredAllocation({
        matchesComplete: false,
        status: 'draft',
        orderIndex: 1,
        deckCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldIgnoreRegisteredAllocation({
        matchesComplete: true,
        status: 'submitted',
        orderIndex: 1,
        deckCount: 1,
      }),
    ).toBe(false);
  });

  it('skips registered siblings and counts extra drafts when ignoreRegisteredSiblings is on', () => {
    const result = buildPoolAllocationMaps(
      [
        makeDeck({
          id: 'registered',
          status: 'submitted',
          orderIndex: 0,
          cards: [{ cachedCardId: 'card-a', quantity: 2 }],
        }),
        makeDeck({
          id: 'extra-other',
          status: 'draft',
          orderIndex: 2,
          cards: [{ cachedCardId: 'card-a', quantity: 1 }],
        }),
        makeDeck({
          id: 'extra-active',
          status: 'draft',
          orderIndex: 1,
          cards: [{ cachedCardId: 'card-a', quantity: 1 }],
        }),
      ],
      'extra-active',
      { ignoreRegisteredSiblings: true, extraSlotMinOrderIndex: 1 },
    );

    expect(result.combinedForAvailability.get('card-a')).toBe(2);
    expect(result.activeDeckByCardId.get('card-a')).toBe(1);
    expect(result.registeredOtherDecksByCardId.get('card-a')).toBe(1);
  });
});
