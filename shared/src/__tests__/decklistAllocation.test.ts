import { describe, expect, it } from 'vitest';
import {
  buildPoolAllocationMaps,
  isExtraDeckSlot,
  isRegisteredDecklistStatus,
  selectExtraDraftsToCarryForward,
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

  it('selects extra drafts that are not already occupying a slot', () => {
    expect(
      selectExtraDraftsToCarryForward({
        requiredDeckCount: 1,
        currentRoundOrderIndexes: [0],
        previousDrafts: [
          { id: 'required-old', orderIndex: 0, roundNumber: 1, status: 'locked' },
          { id: 'extra-old', orderIndex: 1, roundNumber: 1, status: 'draft' },
          { id: 'extra-older', orderIndex: 2, roundNumber: 1, status: 'draft' },
        ],
      }),
    ).toEqual(['extra-old', 'extra-older']);
  });

  it('does not carry required slots, registered extras, or extras that already exist on the current round', () => {
    expect(
      selectExtraDraftsToCarryForward({
        requiredDeckCount: 1,
        currentRoundOrderIndexes: [0, 1],
        previousDrafts: [
          { id: 'required-old', orderIndex: 0, roundNumber: 1, status: 'draft' },
          { id: 'extra-conflict', orderIndex: 1, roundNumber: 1, status: 'draft' },
          { id: 'extra-submitted', orderIndex: 2, roundNumber: 1, status: 'submitted' },
          { id: 'extra-locked', orderIndex: 3, roundNumber: 1, status: 'locked' },
          { id: 'extra-free', orderIndex: 4, roundNumber: 1, status: 'draft' },
        ],
      }),
    ).toEqual(['extra-free']);
  });

  it('prefers the newest previous extra when the same slot exists on multiple earlier rounds', () => {
    expect(
      selectExtraDraftsToCarryForward({
        requiredDeckCount: 1,
        currentRoundOrderIndexes: [0],
        previousDrafts: [
          { id: 'extra-r1', orderIndex: 1, roundNumber: 1, status: 'draft' },
          { id: 'extra-r2', orderIndex: 1, roundNumber: 2, status: 'draft' },
        ],
      }),
    ).toEqual(['extra-r2']);
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
