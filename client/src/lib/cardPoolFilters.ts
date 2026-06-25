import type { PoolCard } from '@/components/cardpool/types';
import { getCardColorCode, getPrimaryType } from '@/lib/cardPoolSort';

export const CARD_TYPE_FILTERS = [
  'Creature',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Planeswalker',
  'Land',
  'Other',
] as const;

export const COLOR_FILTERS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;

export function isBasicLand(typeLine: string) {
  return /\bBasic\s+Land\b/i.test(typeLine);
}

export type PoolCardFilterOptions = {
  selectedColorFilters: string[];
  selectedTypeFilters: string[];
  showBasicLands: boolean;
};

const COLOR_COLOR_HYBRID_REGEX = /\{([WUBRG])\/([WUBRG])\}/g;
const PHYREXIAN_COLOR_REGEX = /\{([WUBRG])\/P\}/g;
const SINGLE_COLOR_REGEX = /\{([WUBRG])\}/g;

export function parseManaCostColors(manaCost: string): {
  fixedColors: Set<string>;
  hybridPips: [string, string][];
} {
  const fixedColors = new Set<string>();
  const hybridPips: [string, string][] = [];

  for (const match of manaCost.matchAll(COLOR_COLOR_HYBRID_REGEX)) {
    hybridPips.push([match[1], match[2]]);
  }

  for (const match of manaCost.matchAll(PHYREXIAN_COLOR_REGEX)) {
    fixedColors.add(match[1]);
  }

  for (const match of manaCost.matchAll(SINGLE_COLOR_REGEX)) {
    fixedColors.add(match[1]);
  }

  return { fixedColors, hybridPips };
}

function matchesHybridColorFilter(
  parse: ReturnType<typeof parseManaCostColors>,
  selectedColorSet: Set<string>,
): boolean {
  if (selectedColorSet.size === 0) {
    return false;
  }

  for (const color of parse.fixedColors) {
    if (!selectedColorSet.has(color)) {
      return false;
    }
  }

  for (const [left, right] of parse.hybridPips) {
    if (!selectedColorSet.has(left) && !selectedColorSet.has(right)) {
      return false;
    }
  }

  return true;
}

function matchesColorFilter(card: PoolCard, selectedColorFilters: string[]): boolean {
  // Empty color selection means "show none" (not "show all").
  const allColorsSelected = selectedColorFilters.length === COLOR_FILTERS.length;
  if (allColorsSelected) {
    return true;
  }

  const cardColorCode = getCardColorCode(card);
  if (!cardColorCode) {
    return selectedColorFilters.includes('C');
  }

  const selectedColorSet = new Set(selectedColorFilters.filter((color) => color !== 'C'));

  if (card.manaCost) {
    const parse = parseManaCostColors(card.manaCost);
    if (parse.hybridPips.length > 0) {
      return matchesHybridColorFilter(parse, selectedColorSet);
    }
  }

  const cardColorSet = new Set(cardColorCode.split(''));
  return selectedColorSet.size > 0 && [...cardColorSet].every((color) => selectedColorSet.has(color));
}

function matchesTypeFilter(card: PoolCard, selectedTypeFilters: string[]): boolean {
  // Empty type selection means "show none" (not "show all").
  const allTypesSelected = selectedTypeFilters.length === CARD_TYPE_FILTERS.length;
  if (allTypesSelected) {
    return true;
  }
  return selectedTypeFilters.includes(getPrimaryType(card.typeLine));
}

export function filterPoolCards(cards: PoolCard[], options: PoolCardFilterOptions): PoolCard[] {
  const { selectedColorFilters, selectedTypeFilters, showBasicLands } = options;

  return cards.filter((card) => {
    if (!matchesTypeFilter(card, selectedTypeFilters)) {
      return false;
    }
    if (!matchesColorFilter(card, selectedColorFilters)) {
      return false;
    }
    if (!showBasicLands && isBasicLand(card.typeLine)) {
      return false;
    }
    return true;
  });
}
