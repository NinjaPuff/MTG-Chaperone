import { describe, expect, it } from 'vitest';
import {
  applyMainBasicLandsChange,
  applySideboardBasicLandsChange,
  extractBasicCounts,
  syncDeckBasicLands,
} from '@/lib/deckBasicLands';
import type { BuilderDeck, DeckBuilderCard } from '@/components/deckbuilder/types';

const catalog = new Map([
  [
    'Plains',
    {
      cachedCardId: 'plains-id',
      name: 'Plains',
      manaCost: null,
      typeLine: 'Basic Land — Plains',
      colorIdentity: ['W'],
    },
  ],
  [
    'Forest',
    {
      cachedCardId: 'forest-id',
      name: 'Forest',
      manaCost: null,
      typeLine: 'Basic Land — Forest',
      colorIdentity: ['G'],
    },
  ],
]);

function makeDeck(cards: DeckBuilderCard[]): BuilderDeck {
  return {
    id: 'deck-1',
    orderIndex: 0,
    name: 'Deck 1',
    status: 'draft',
    cards,
    basicLands: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    },
  };
}

function makeCard(overrides: Partial<DeckBuilderCard>): DeckBuilderCard {
  return {
    cachedCardId: overrides.cachedCardId ?? 'card-1',
    name: overrides.name ?? 'Lightning Bolt',
    layout: null,
    manaCost: '{R}',
    typeLine: 'Instant',
    cmc: 1,
    quantity: overrides.quantity ?? 1,
    zone: overrides.zone ?? 'main',
    colorIdentity: ['R'],
    ...overrides,
  };
}

describe('applyMainBasicLandsChange', () => {
  it('preserves sideboard basic lands when updating main-deck basics', () => {
    const deck = makeDeck([
      makeCard({ cachedCardId: 'forest-id', name: 'Forest', typeLine: 'Basic Land — Forest', cmc: 0, zone: 'sideboard', quantity: 3 }),
      makeCard({ cachedCardId: 'spell-1', name: 'Shock' }),
    ]);

    const next = applyMainBasicLandsChange(
      deck,
      { Plains: 4, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 },
      catalog,
    );

    const sideboardForest = next.cards.find((card) => card.name === 'Forest' && card.zone === 'sideboard');
    expect(sideboardForest?.quantity).toBe(3);
    expect(next.cards.filter((card) => card.name === 'Plains' && card.zone === 'main')).toHaveLength(1);
    expect(next.cards.find((card) => card.name === 'Plains' && card.zone === 'main')?.quantity).toBe(4);
  });
});

describe('applySideboardBasicLandsChange', () => {
  it('preserves main-deck basic lands when updating sideboard basics', () => {
    const deck = makeDeck([
      makeCard({ cachedCardId: 'plains-id', name: 'Plains', typeLine: 'Basic Land — Plains', cmc: 0, zone: 'main', quantity: 8 }),
      makeCard({ cachedCardId: 'spell-1', name: 'Shock' }),
    ]);

    const next = applySideboardBasicLandsChange(
      deck,
      { Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 2 },
      catalog,
    );

    const mainPlains = next.cards.find((card) => card.name === 'Plains' && card.zone === 'main');
    expect(mainPlains?.quantity).toBe(8);
    expect(next.cards.find((card) => card.name === 'Forest' && card.zone === 'sideboard')?.quantity).toBe(2);
  });
});

describe('syncDeckBasicLands', () => {
  it('updates stale basicLands after main-deck basic cards change', () => {
    const deck = makeDeck([
      makeCard({ cachedCardId: 'forest-id', name: 'Forest', typeLine: 'Basic Land — Forest', cmc: 0, zone: 'main', quantity: 5 }),
    ]);

    const synced = syncDeckBasicLands(deck);
    expect(synced.basicLands.Forest).toBe(5);
  });
});

describe('historical Wastes copies', () => {
  it('preserves main-deck Wastes when replacing other basics', () => {
    const deck = makeDeck([
      makeCard({
        cachedCardId: 'wastes-id',
        name: 'Wastes',
        typeLine: 'Basic Land',
        cmc: 0,
        zone: 'main',
        quantity: 3,
      }),
      makeCard({
        cachedCardId: 'plains-id',
        name: 'Plains',
        typeLine: 'Basic Land — Plains',
        cmc: 0,
        zone: 'main',
        quantity: 2,
      }),
    ]);

    expect(extractBasicCounts(deck.cards)).not.toHaveProperty('Wastes');

    const next = applyMainBasicLandsChange(
      deck,
      { Plains: 4, Island: 0, Swamp: 0, Mountain: 0, Forest: 1 },
      catalog,
    );

    expect(next.cards.find((card) => card.name === 'Wastes' && card.zone === 'main')?.quantity).toBe(3);
    expect(extractBasicCounts(next.cards)).not.toHaveProperty('Wastes');
  });
});
