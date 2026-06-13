export type DeckAllocationCard = {
  cachedCardId: string;
  quantity: number;
};

export type DeckAllocationDeck = {
  id: string;
  status: 'draft' | 'submitted' | 'locked';
  cards: DeckAllocationCard[];
};

export function isRegisteredDecklistStatus(status: DeckAllocationDeck['status']) {
  return status === 'submitted' || status === 'locked';
}

function addCardQty(target: Map<string, number>, cardId: string, quantity: number) {
  target.set(cardId, (target.get(cardId) ?? 0) + quantity);
}

export function buildPoolAllocationMaps(decks: DeckAllocationDeck[], activeDeckId: string | null) {
  const combinedForAvailability = new Map<string, number>();
  const activeDeckByCardId = new Map<string, number>();
  const registeredOtherDecksByCardId = new Map<string, number>();

  for (const deck of decks) {
    const isActiveDeck = activeDeckId !== null && deck.id === activeDeckId;
    const isRegisteredDeck = isRegisteredDecklistStatus(deck.status);
    if (!isActiveDeck && !isRegisteredDeck) {
      continue;
    }

    for (const card of deck.cards) {
      if (isActiveDeck) {
        addCardQty(activeDeckByCardId, card.cachedCardId, card.quantity);
      } else {
        addCardQty(registeredOtherDecksByCardId, card.cachedCardId, card.quantity);
      }
      addCardQty(combinedForAvailability, card.cachedCardId, card.quantity);
    }
  }

  return {
    combinedForAvailability,
    activeDeckByCardId,
    registeredOtherDecksByCardId,
  };
}
