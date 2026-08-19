export const PREP_DECK_SIZES = [40, 60] as const;
export type PrepDeckSize = (typeof PREP_DECK_SIZES)[number];

function storageKey(deckId: string): string {
  return `deckbuilder-prep-size:${deckId}`;
}

function normalizePrepDeckSize(value: unknown): PrepDeckSize | null {
  return value === 40 || value === 60 ? value : null;
}

export function otherPrepSize(eventMinDeckSize: number): PrepDeckSize {
  return eventMinDeckSize === 60 ? 40 : 60;
}

export function isExtraDeckSlot(orderIndex: number, requiredDeckCount: number): boolean {
  return orderIndex >= Math.max(1, requiredDeckCount);
}

export function readStoredPrepSize(deckId: string): PrepDeckSize | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(deckId));
    if (!raw) {
      return null;
    }
    return normalizePrepDeckSize(Number(raw));
  } catch {
    return null;
  }
}

export function writeStoredPrepSize(deckId: string, size: PrepDeckSize): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(deckId), String(size));
  } catch {
    // Ignore storage failures and keep in-memory state.
  }
}

export function resolveBuilderSizeTarget(args: {
  orderIndex: number;
  requiredDeckCount: number;
  eventMinDeckSize: number;
  stored: PrepDeckSize | null;
}): number {
  if (!isExtraDeckSlot(args.orderIndex, args.requiredDeckCount)) {
    return args.eventMinDeckSize;
  }

  return args.stored ?? otherPrepSize(args.eventMinDeckSize);
}
