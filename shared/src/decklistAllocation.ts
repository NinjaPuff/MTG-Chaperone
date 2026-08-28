export type DeckAllocationCard = {
  cachedCardId: string;
  quantity: number;
};

export type DeckAllocationDeck = {
  id: string;
  status: 'draft' | 'submitted' | 'locked';
  cards: DeckAllocationCard[];
  orderIndex?: number;
};

export type PoolAllocationOptions = {
  ignoreRegisteredSiblings?: boolean;
};

export function isRegisteredDecklistStatus(status: DeckAllocationDeck['status']) {
  return status === 'submitted' || status === 'locked';
}

export function isExtraDeckSlot(orderIndex: number, requiredDeckCount: number): boolean {
  return orderIndex >= Math.max(1, requiredDeckCount);
}

export type ExtraDraftCarryCandidate = {
  id: string;
  orderIndex: number;
  roundNumber: number;
  status: DeckAllocationDeck['status'];
};

export function selectExtraDraftsToCarryForward(args: {
  requiredDeckCount: number;
  currentEventOrderIndexes: number[];
  previousDrafts: ExtraDraftCarryCandidate[];
}): string[] {
  const occupied = new Set(args.currentEventOrderIndexes);
  const chosen: string[] = [];
  const ranked = [...args.previousDrafts].sort(
    (left, right) => right.roundNumber - left.roundNumber || left.orderIndex - right.orderIndex,
  );

  for (const draft of ranked) {
    if (draft.status !== 'draft' || !isExtraDeckSlot(draft.orderIndex, args.requiredDeckCount)) {
      continue;
    }
    if (occupied.has(draft.orderIndex)) {
      continue;
    }
    occupied.add(draft.orderIndex);
    chosen.push(draft.id);
  }

  return chosen;
}

export function shouldIgnoreRegisteredAllocation(args: {
  matchesComplete: boolean;
  status: DeckAllocationDeck['status'];
  orderIndex: number;
  deckCount: number;
}): boolean {
  return args.matchesComplete && args.status === 'draft' && isExtraDeckSlot(args.orderIndex, args.deckCount);
}

function addCardQty(target: Map<string, number>, cardId: string, quantity: number) {
  target.set(cardId, (target.get(cardId) ?? 0) + quantity);
}

export function buildPoolAllocationMaps(
  decks: DeckAllocationDeck[],
  activeDeckId: string | null,
  options?: PoolAllocationOptions,
) {
  const combinedForAvailability = new Map<string, number>();
  const activeDeckByCardId = new Map<string, number>();
  const registeredOtherDecksByCardId = new Map<string, number>();
  const ignoreRegistered = options?.ignoreRegisteredSiblings === true;

  for (const deck of decks) {
    const isActiveDeck = activeDeckId !== null && deck.id === activeDeckId;
    const isRegisteredDeck = isRegisteredDecklistStatus(deck.status);

    if (ignoreRegistered) {
      if (!isActiveDeck) {
        continue;
      }
    } else if (!isActiveDeck && !isRegisteredDeck) {
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
