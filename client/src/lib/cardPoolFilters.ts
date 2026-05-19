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

function matchesColorFilter(card: PoolCard, selectedColorFilters: string[]): boolean {
  const allColorsSelected = selectedColorFilters.length === COLOR_FILTERS.length;
  if (allColorsSelected) {
    return true;
  }

  const cardColorCode = getCardColorCode(card);
  if (!cardColorCode) {
    return selectedColorFilters.includes('C');
  }

  const selectedColorSet = new Set(selectedColorFilters.filter((color) => color !== 'C'));
  const cardColorSet = new Set(cardColorCode.split(''));
  return selectedColorSet.size > 0 && [...cardColorSet].every((color) => selectedColorSet.has(color));
}

function matchesTypeFilter(card: PoolCard, selectedTypeFilters: string[]): boolean {
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
