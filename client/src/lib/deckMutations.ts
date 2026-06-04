import type { BuilderDeck, DeckBuilderCard } from '@/components/deckbuilder/types';

export function moveCardBetweenZones(
  decks: BuilderDeck[],
  deckId: string,
  cachedCardId: string,
  sourceZone: 'main' | 'sideboard',
  targetZone: 'main' | 'sideboard',
): BuilderDeck[] {
  if (sourceZone === targetZone) {
    return decks;
  }

  const deckIndex = decks.findIndex((deck) => deck.id === deckId);
  if (deckIndex === -1) {
    return decks;
  }

  const deck = decks[deckIndex];
  const sourceIndex = deck.cards.findIndex(
    (card) => card.cachedCardId === cachedCardId && card.zone === sourceZone,
  );
  if (sourceIndex === -1) {
    return decks;
  }

  const sourceCard = deck.cards[sourceIndex];
  const nextCards = [...deck.cards];

  if (sourceCard.quantity <= 1) {
    nextCards.splice(sourceIndex, 1);
  } else {
    nextCards[sourceIndex] = { ...sourceCard, quantity: sourceCard.quantity - 1 };
  }

  const targetIndex = nextCards.findIndex(
    (card) => card.cachedCardId === cachedCardId && card.zone === targetZone,
  );
  if (targetIndex === -1) {
    const moved: DeckBuilderCard = {
      ...sourceCard,
      quantity: 1,
      zone: targetZone,
    };
    nextCards.push(moved);
  } else {
    nextCards[targetIndex] = {
      ...nextCards[targetIndex],
      quantity: nextCards[targetIndex].quantity + 1,
    };
  }

  const nextDeck: BuilderDeck = { ...deck, cards: nextCards };
  return decks.map((entry, index) => (index === deckIndex ? nextDeck : entry));
}
