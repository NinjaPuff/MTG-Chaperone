export type SuggestBasicLandCard = {
  quantity: number;
  manaCost: string | null;
  typeLine: string;
  colorIdentity?: string[] | null;
};

export type BasicLandSuggestion = {
  Plains: number;
  Island: number;
  Swamp: number;
  Mountain: number;
  Forest: number;
  Wastes: number;
};

type ColorCode = 'W' | 'U' | 'B' | 'R' | 'G';

const COLOR_TO_BASIC: Record<ColorCode, keyof BasicLandSuggestion> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

const COLORS: ColorCode[] = ['W', 'U', 'B', 'R', 'G'];

function isLand(typeLine: string) {
  return /\bLand\b/i.test(typeLine);
}

function isBasicLand(typeLine: string) {
  return /\bBasic\s+Land\b/i.test(typeLine);
}

function extractPips(manaCost: string | null) {
  const map = new Map<ColorCode, number>(COLORS.map((color) => [color, 0]));
  if (!manaCost) {
    return map;
  }
  const regex = /\{([WUBRG])\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(manaCost)) !== null) {
    const symbol = match[1] as ColorCode;
    map.set(symbol, (map.get(symbol) ?? 0) + 1);
  }
  return map;
}

function emptySuggestion(): BasicLandSuggestion {
  return {
    Plains: 0,
    Island: 0,
    Swamp: 0,
    Mountain: 0,
    Forest: 0,
    Wastes: 0,
  };
}

export function suggestBasicLands(deckCards: SuggestBasicLandCard[], minDeckSize: number): BasicLandSuggestion {
  const suggestion = emptySuggestion();
  const colorDemand = new Map<ColorCode, number>(COLORS.map((color) => [color, 0]));
  const nonbasicSupply = new Map<ColorCode, number>(COLORS.map((color) => [color, 0]));

  let nonLandCount = 0;
  let nonbasicLandCount = 0;

  for (const card of deckCards) {
    const quantity = Math.max(0, Math.floor(card.quantity));
    if (quantity < 1) {
      continue;
    }

    const cardIsLand = isLand(card.typeLine);
    if (!cardIsLand) {
      nonLandCount += quantity;
      const pips = extractPips(card.manaCost);
      for (const color of COLORS) {
        colorDemand.set(color, (colorDemand.get(color) ?? 0) + (pips.get(color) ?? 0) * quantity);
      }
      continue;
    }

    if (isBasicLand(card.typeLine)) {
      continue;
    }

    nonbasicLandCount += quantity;
    const colors = (card.colorIdentity ?? []).filter((value): value is ColorCode =>
      value === 'W' || value === 'U' || value === 'B' || value === 'R' || value === 'G',
    );

    if (colors.length === 0) {
      continue;
    }

    const contribution = quantity / colors.length;
    for (const color of colors) {
      nonbasicSupply.set(color, (nonbasicSupply.get(color) ?? 0) + contribution);
    }
  }

  const targetSize = Math.max(0, Math.floor(minDeckSize));
  const basicLandSlots = Math.max(0, targetSize - nonLandCount - nonbasicLandCount);
  if (basicLandSlots === 0) {
    return suggestion;
  }

  const unmetDemand = new Map<ColorCode, number>();
  for (const color of COLORS) {
    const unmet = Math.max(0, (colorDemand.get(color) ?? 0) - (nonbasicSupply.get(color) ?? 0));
    unmetDemand.set(color, unmet);
  }

  const totalUnmet = [...unmetDemand.values()].reduce((sum, value) => sum + value, 0);
  if (totalUnmet <= 0) {
    suggestion.Wastes = basicLandSlots;
    return suggestion;
  }

  const rawShares = new Map<ColorCode, number>();
  const allocations = new Map<ColorCode, number>(COLORS.map((color) => [color, 0]));

  for (const color of COLORS) {
    const raw = ((unmetDemand.get(color) ?? 0) / totalUnmet) * basicLandSlots;
    rawShares.set(color, raw);
    allocations.set(color, Math.floor(raw));
  }

  let assigned = [...allocations.values()].reduce((sum, value) => sum + value, 0);
  const remainderOrder = [...COLORS].sort((a, b) => {
    const diff = (rawShares.get(b) ?? 0) - Math.floor(rawShares.get(b) ?? 0) - ((rawShares.get(a) ?? 0) - Math.floor(rawShares.get(a) ?? 0));
    if (diff !== 0) {
      return diff;
    }
    return COLORS.indexOf(a) - COLORS.indexOf(b);
  });

  for (const color of remainderOrder) {
    if (assigned >= basicLandSlots) {
      break;
    }
    allocations.set(color, (allocations.get(color) ?? 0) + 1);
    assigned += 1;
  }

  const colorsWithDemand = COLORS.filter((color) => (unmetDemand.get(color) ?? 0) > 0);
  if (colorsWithDemand.length > 0 && basicLandSlots >= colorsWithDemand.length) {
    for (const color of colorsWithDemand) {
      if ((allocations.get(color) ?? 0) > 0) {
        continue;
      }
      const donor = COLORS.find((candidate) => (allocations.get(candidate) ?? 0) > 1);
      if (!donor) {
        continue;
      }
      allocations.set(donor, (allocations.get(donor) ?? 0) - 1);
      allocations.set(color, 1);
    }
  }

  for (const color of COLORS) {
    suggestion[COLOR_TO_BASIC[color]] = allocations.get(color) ?? 0;
  }
  return suggestion;
}
