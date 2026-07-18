import type { BuilderDeck, DeckBuilderCard } from '@/components/deckbuilder/types';
import type { BasicLandSuggestion } from '@/lib/suggestBasicLands';

export const BASIC_LAND_ORDER = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'] as const;

export type BasicLandCatalogEntry = {
  cachedCardId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  colorIdentity: string[];
};

export function getDefaultBasicLandCounts(): BasicLandSuggestion {
  return {
    Plains: 0,
    Island: 0,
    Swamp: 0,
    Mountain: 0,
    Forest: 0,
    Wastes: 0,
  };
}

export function isBasicLandName(name: string): name is (typeof BASIC_LAND_ORDER)[number] {
  return BASIC_LAND_ORDER.includes(name as (typeof BASIC_LAND_ORDER)[number]);
}

export function extractBasicCounts(cards: DeckBuilderCard[]): BasicLandSuggestion {
  const counts = getDefaultBasicLandCounts();
  for (const card of cards) {
    if (card.zone !== 'main') {
      continue;
    }
    if (isBasicLandName(card.name)) {
      counts[card.name] += card.quantity;
    }
  }
  return counts;
}

export function extractSideboardBasicCounts(cards: DeckBuilderCard[]): BasicLandSuggestion {
  const counts = getDefaultBasicLandCounts();
  for (const card of cards) {
    if (card.zone !== 'sideboard') {
      continue;
    }
    if (isBasicLandName(card.name)) {
      counts[card.name] += card.quantity;
    }
  }
  return counts;
}

function basicLandCountsEqual(left: BasicLandSuggestion, right: BasicLandSuggestion) {
  return BASIC_LAND_ORDER.every((land) => left[land] === right[land]);
}

export function syncDeckBasicLands(deck: BuilderDeck): BuilderDeck {
  const fresh = extractBasicCounts(deck.cards);
  if (basicLandCountsEqual(deck.basicLands, fresh)) {
    return deck;
  }
  return { ...deck, basicLands: fresh };
}

function buildBasicLandCards(
  counts: BasicLandSuggestion,
  zone: 'main' | 'sideboard',
  catalog: Map<string, BasicLandCatalogEntry>,
): DeckBuilderCard[] {
  return BASIC_LAND_ORDER.flatMap((landName) => {
    const qty = counts[landName];
    const entry = catalog.get(landName);
    if (!entry || qty < 1) {
      return [];
    }
    return [
      {
        cachedCardId: entry.cachedCardId,
        name: entry.name,
        layout: null,
        manaCost: entry.manaCost,
        typeLine: entry.typeLine,
        cmc: 0,
        quantity: qty,
        zone,
        colorIdentity: entry.colorIdentity,
      },
    ];
  });
}

export function applyMainBasicLandsChange(
  deck: BuilderDeck,
  next: BasicLandSuggestion,
  catalog: Map<string, BasicLandCatalogEntry>,
): BuilderDeck {
  const preservedCards = deck.cards.filter(
    (card) => card.zone === 'sideboard' || !isBasicLandName(card.name),
  );
  const mainBasicCards = buildBasicLandCards(next, 'main', catalog);
  return {
    ...deck,
    cards: [...preservedCards, ...mainBasicCards],
    basicLands: next,
  };
}

export function applySideboardBasicLandsChange(
  deck: BuilderDeck,
  next: BasicLandSuggestion,
  catalog: Map<string, BasicLandCatalogEntry>,
): BuilderDeck {
  const preservedCards = deck.cards.filter(
    (card) => card.zone !== 'sideboard' || !isBasicLandName(card.name),
  );
  const sideboardBasicCards = buildBasicLandCards(next, 'sideboard', catalog);
  return {
    ...deck,
    cards: [...preservedCards, ...sideboardBasicCards],
  };
}

export function deckEntryCards(deck: BuilderDeck) {
  const mainBasicEntries = BASIC_LAND_ORDER.flatMap((landName) => {
    const qty = deck.basicLands[landName];
    if (qty < 1) {
      return [];
    }
    const existing = deck.cards.find((card) => card.zone === 'main' && card.name === landName);
    if (!existing) {
      return [];
    }
    return [
      {
        cachedCardId: existing.cachedCardId,
        quantity: qty,
        zone: 'main' as const,
      },
    ];
  });

  const nonMainBasicEntries = deck.cards
    .filter((card) => card.zone === 'sideboard' || !isBasicLandName(card.name))
    .map((card) => ({
      cachedCardId: card.cachedCardId,
      quantity: card.quantity,
      zone: card.zone,
    }));

  return [...nonMainBasicEntries, ...mainBasicEntries];
}
