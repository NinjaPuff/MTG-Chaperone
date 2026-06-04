import { describe, expect, it } from 'vitest';
import type { PoolCard } from '../../components/cardpool/types';
import {
  CARD_TYPE_FILTERS,
  COLOR_FILTERS,
  filterPoolCards,
} from '../../lib/cardPoolFilters';

function makeCard(overrides: Partial<PoolCard> = {}): PoolCard {
  return {
    scryfallId: overrides.scryfallId ?? crypto.randomUUID(),
    name: overrides.name ?? 'Card',
    layout: overrides.layout ?? null,
    manaCost: overrides.manaCost ?? null,
    typeLine: overrides.typeLine ?? 'Creature — Test',
    rarity: overrides.rarity ?? 'common',
    setCode: overrides.setCode ?? 'TST',
    imageUris: overrides.imageUris ?? null,
    cmc: overrides.cmc ?? 0,
    colors: overrides.colors ?? [],
    colorIdentity: overrides.colorIdentity ?? overrides.colors ?? [],
    quantity: overrides.quantity ?? 1,
    phaseLabel: overrides.phaseLabel ?? 'Initial Pool',
    phaseQuantities: overrides.phaseQuantities ?? { [overrides.phaseLabel ?? 'Initial Pool']: overrides.quantity ?? 1 },
  };
}

const allFiltersOn = {
  selectedColorFilters: [...COLOR_FILTERS],
  selectedTypeFilters: [...CARD_TYPE_FILTERS],
  showBasicLands: true,
};

describe('filterPoolCards', () => {
  const pool = [
    makeCard({ scryfallId: 'creature', name: 'Bear', typeLine: 'Creature — Bear', colorIdentity: ['G'] }),
    makeCard({ scryfallId: 'instant', name: 'Shock', typeLine: 'Instant', colorIdentity: ['R'] }),
    makeCard({
      scryfallId: 'azorius',
      name: 'Azorius Charm',
      typeLine: 'Instant',
      colorIdentity: ['W', 'U'],
    }),
    makeCard({
      scryfallId: 'plains',
      name: 'Plains',
      typeLine: 'Basic Land — Plains',
      colorIdentity: ['W'],
    }),
    makeCard({
      scryfallId: 'wastes',
      name: 'Wastes',
      typeLine: 'Land',
      colorIdentity: [],
      colors: [],
    }),
  ];

  it('returns all cards when all filters are on', () => {
    const result = filterPoolCards(pool, allFiltersOn);
    expect(result.map((card) => card.scryfallId)).toEqual(
      pool.map((card) => card.scryfallId),
    );
  });

  it('excludes creatures when Creature type is deselected', () => {
    const result = filterPoolCards(pool, {
      ...allFiltersOn,
      selectedTypeFilters: CARD_TYPE_FILTERS.filter((type) => type !== 'Creature'),
    });
    expect(result.some((card) => card.scryfallId === 'creature')).toBe(false);
    expect(result.some((card) => card.scryfallId === 'instant')).toBe(true);
  });

  it('shows only mono-white cards when only W is selected', () => {
    const result = filterPoolCards(pool, {
      ...allFiltersOn,
      selectedColorFilters: ['W'],
    });
    expect(result.map((card) => card.scryfallId)).toEqual(['plains']);
  });

  it('shows multicolor cards only when all of their colors are selected', () => {
    const wOnly = filterPoolCards(pool, {
      ...allFiltersOn,
      selectedColorFilters: ['W'],
    });
    expect(wOnly.some((card) => card.scryfallId === 'azorius')).toBe(false);

    const wu = filterPoolCards(pool, {
      ...allFiltersOn,
      selectedColorFilters: ['W', 'U'],
    });
    expect(wu.some((card) => card.scryfallId === 'azorius')).toBe(true);
  });

  it('shows colorless cards only when C is selected', () => {
    const withoutC = filterPoolCards(pool, {
      ...allFiltersOn,
      selectedColorFilters: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(withoutC.some((card) => card.scryfallId === 'wastes')).toBe(false);

    const withC = filterPoolCards(pool, {
      ...allFiltersOn,
      selectedColorFilters: ['C'],
    });
    expect(withC.some((card) => card.scryfallId === 'wastes')).toBe(true);
  });

  it('shows no cards when color filters are empty', () => {
    const result = filterPoolCards(pool, {
      ...allFiltersOn,
      selectedColorFilters: [],
    });
    expect(result).toHaveLength(0);
  });

  it('hides basic lands when showBasicLands is false', () => {
    const result = filterPoolCards(pool, {
      ...allFiltersOn,
      showBasicLands: false,
    });
    expect(result.some((card) => card.scryfallId === 'plains')).toBe(false);
    expect(result.some((card) => card.scryfallId === 'creature')).toBe(true);
  });
});
