type StagedPoolChangeLike = {
  action: string;
};

export type StagedCardAddInput = {
  cachedCardId: string;
  name: string;
  flavorName?: string | null;
  setCode: string;
  manaCost: string | null;
  imageUri: string | null;
  quantity: number;
};

export type StagedCardLike = StagedCardAddInput & {
  phaseLabel: string;
};

export function hasStagedRemovals(changes: StagedPoolChangeLike[]): boolean {
  return changes.some((change) => change.action === 'remove_one' || change.action === 'remove_all');
}

export function buildApplyStagedRemovalsConfirmMessage(totalChanges: number, removalCount: number): string {
  return `Apply ${totalChanges} staged change${totalChanges === 1 ? '' : 's'} including ${removalCount} removal${removalCount === 1 ? '' : 's'}? This updates the pool immediately.`;
}

export function countStagedRemovals(changes: StagedPoolChangeLike[]): number {
  return changes.filter((change) => change.action === 'remove_one' || change.action === 'remove_all').length;
}

export function sumStagedCardQuantities(cards: Array<{ quantity: number }>): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

export function countStagedAddCardTotal(
  stagedCards: Array<{ quantity: number }>,
  stagedPoolChanges: Array<{ action: string; quantity: number }>,
): number {
  const stagedAddsFromChanges = stagedPoolChanges
    .filter((change) => change.action === 'add')
    .reduce((sum, change) => sum + change.quantity, 0);
  return sumStagedCardQuantities(stagedCards) + stagedAddsFromChanges;
}

export function mergeStagedCardAdds(
  prev: StagedCardLike[],
  additions: StagedCardAddInput[],
  phaseLabel: string,
): StagedCardLike[] {
  const next = [...prev];

  for (const addition of additions) {
    const existingIndex = next.findIndex(
      (entry) => entry.cachedCardId === addition.cachedCardId && entry.phaseLabel === phaseLabel,
    );

    if (existingIndex === -1) {
      next.push({
        cachedCardId: addition.cachedCardId,
        name: addition.name,
        flavorName: addition.flavorName ?? null,
        setCode: addition.setCode,
        manaCost: addition.manaCost,
        imageUri: addition.imageUri,
        quantity: addition.quantity,
        phaseLabel,
      });
      continue;
    }

    next[existingIndex] = {
      ...next[existingIndex],
      quantity: next[existingIndex].quantity + addition.quantity,
    };
  }

  return next;
}
