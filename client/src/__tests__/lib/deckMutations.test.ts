import { describe, expect, it } from 'vitest';
import { moveCardBetweenZones } from '@/lib/deckMutations';
import type { BuilderDeck, DeckBuilderCard } from '@/components/deckbuilder/types';

function makeDeck(id: string, cards: DeckBuilderCard[] = []): BuilderDeck {
  return {
    id,
    orderIndex: 0,
    name: `Deck ${id}`,
    status: 'draft',
    cards,
    basicLands: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
      Wastes: 0,
    },
  };
}

function makeCard(overrides: Partial<DeckBuilderCard> = {}): DeckBuilderCard {
  return {
    cachedCardId: overrides.cachedCardId ?? 'card-1',
    name: overrides.name ?? 'Test Card',
    manaCost: overrides.manaCost ?? '{2}',
    typeLine: overrides.typeLine ?? 'Creature',
    cmc: overrides.cmc ?? 2,
    quantity: overrides.quantity ?? 1,
    zone: overrides.zone ?? 'main',
    colorIdentity: overrides.colorIdentity ?? ['G'],
    ...overrides,
  };
}

function findCard(deck: BuilderDeck, cachedCardId: string, zone: 'main' | 'sideboard') {
  return deck.cards.find((card) => card.cachedCardId === cachedCardId && card.zone === zone);
}

describe('moveCardBetweenZones', () => {
  it('should_move_one_copy_from_main_to_sideboard_when_source_quantity_gt_1', () => {
    const decks = [makeDeck('deck-1', [makeCard({ quantity: 3 })])];
    const result = moveCardBetweenZones(decks, 'deck-1', 'card-1', 'main', 'sideboard');

    expect(findCard(result[0], 'card-1', 'main')?.quantity).toBe(2);
    expect(findCard(result[0], 'card-1', 'sideboard')?.quantity).toBe(1);
  });

  it('should_remove_main_row_and_create_sideboard_row_when_source_quantity_is_1', () => {
    const decks = [makeDeck('deck-1', [makeCard({ quantity: 1 })])];
    const result = moveCardBetweenZones(decks, 'deck-1', 'card-1', 'main', 'sideboard');

    expect(findCard(result[0], 'card-1', 'main')).toBeUndefined();
    expect(findCard(result[0], 'card-1', 'sideboard')?.quantity).toBe(1);
  });

  it('should_merge_into_existing_sideboard_row_when_target_already_has_card', () => {
    const decks = [
      makeDeck('deck-1', [
        makeCard({ quantity: 2, zone: 'main' }),
        makeCard({ quantity: 1, zone: 'sideboard' }),
      ]),
    ];
    const result = moveCardBetweenZones(decks, 'deck-1', 'card-1', 'main', 'sideboard');

    expect(findCard(result[0], 'card-1', 'main')?.quantity).toBe(1);
    expect(findCard(result[0], 'card-1', 'sideboard')?.quantity).toBe(2);
  });

  it('should_move_from_sideboard_to_main', () => {
    const decks = [makeDeck('deck-1', [makeCard({ quantity: 2, zone: 'sideboard' })])];
    const result = moveCardBetweenZones(decks, 'deck-1', 'card-1', 'sideboard', 'main');

    expect(findCard(result[0], 'card-1', 'sideboard')?.quantity).toBe(1);
    expect(findCard(result[0], 'card-1', 'main')?.quantity).toBe(1);
  });

  it('should_return_unchanged_decks_when_source_card_missing', () => {
    const decks = [makeDeck('deck-1', [])];
    const result = moveCardBetweenZones(decks, 'deck-1', 'missing', 'main', 'sideboard');

    expect(result).toBe(decks);
  });

  it('should_return_unchanged_decks_when_source_and_target_zone_equal', () => {
    const decks = [makeDeck('deck-1', [makeCard({ quantity: 2 })])];
    const result = moveCardBetweenZones(decks, 'deck-1', 'card-1', 'main', 'main');

    expect(result).toBe(decks);
  });

  it('should_only_mutate_matching_deck_id', () => {
    const otherDeck = makeDeck('deck-2', [makeCard({ cachedCardId: 'other', quantity: 1 })]);
    const targetDeck = makeDeck('deck-1', [makeCard({ quantity: 1 })]);
    const decks = [otherDeck, targetDeck];
    const result = moveCardBetweenZones(decks, 'deck-1', 'card-1', 'main', 'sideboard');

    expect(result[0]).toBe(otherDeck);
    expect(findCard(result[1], 'card-1', 'main')).toBeUndefined();
    expect(findCard(result[1], 'card-1', 'sideboard')?.quantity).toBe(1);
  });
});
