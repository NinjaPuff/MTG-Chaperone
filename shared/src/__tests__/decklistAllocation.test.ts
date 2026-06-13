import { describe, expect, it } from 'vitest';
import { buildPoolAllocationMaps, isRegisteredDecklistStatus, type DeckAllocationDeck } from '../decklistAllocation.js';

function makeDeck(overrides: Partial<DeckAllocationDeck>): DeckAllocationDeck {
  return {
    id: overrides.id ?? 'deck-1',
    status: overrides.status ?? 'draft',
    cards: overrides.cards ?? [],
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
});
