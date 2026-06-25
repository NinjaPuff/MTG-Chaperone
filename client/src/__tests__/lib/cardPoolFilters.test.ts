import { describe, expect, it } from 'vitest';
import type { PoolCard } from '../../components/cardpool/types';
import {
  CARD_TYPE_FILTERS,
  COLOR_FILTERS,
  filterPoolCards,
  parseManaCostColors,
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

function expectSetEqual(actual: Set<string>, expected: string[]) {
  expect([...actual].sort()).toEqual([...expected].sort());
}

describe('parseManaCostColors', () => {
  it('parses color-color hybrid pips', () => {
    const result = parseManaCostColors('{R/W}');
    expectSetEqual(result.fixedColors, []);
    expect(result.hybridPips).toEqual([['R', 'W']]);
  });

  it('parses fixed and hybrid pips together', () => {
    const result = parseManaCostColors('{1}{R/W}{U}');
    expectSetEqual(result.fixedColors, ['U']);
    expect(result.hybridPips).toEqual([['R', 'W']]);
  });

  it('parses non-hybrid multicolor as fixed only', () => {
    const result = parseManaCostColors('{R}{W}');
    expectSetEqual(result.fixedColors, ['R', 'W']);
    expect(result.hybridPips).toEqual([]);
  });

  it('ignores generic-color hybrid pips', () => {
    const result = parseManaCostColors('{2/W}{2/U}');
    expectSetEqual(result.fixedColors, []);
    expect(result.hybridPips).toEqual([]);
  });

  it('parses Phyrexian pips as fixed colors', () => {
    const result = parseManaCostColors('{G/P}');
    expectSetEqual(result.fixedColors, ['G']);
    expect(result.hybridPips).toEqual([]);
  });

  it('parses hybrid and Phyrexian pips together', () => {
    const result = parseManaCostColors('{R/W}{G/P}');
    expectSetEqual(result.fixedColors, ['G']);
    expect(result.hybridPips).toEqual([['R', 'W']]);
  });

  it('parses multiple hybrid pips', () => {
    const result = parseManaCostColors('{R/W}{B/G}');
    expectSetEqual(result.fixedColors, []);
    expect(result.hybridPips).toEqual([
      ['R', 'W'],
      ['B', 'G'],
    ]);
  });

  it('parses split adventure mana costs across both halves', () => {
    const result = parseManaCostColors('{R/W} // {U}');
    expectSetEqual(result.fixedColors, ['U']);
    expect(result.hybridPips).toEqual([['R', 'W']]);
  });
});

describe('filterPoolCards hybrid color filtering', () => {
  const hybridPool = [
    makeCard({
      scryfallId: 'hybrid-rw',
      name: 'Boros Recruit',
      manaCost: '{R/W}',
      colorIdentity: ['R', 'W'],
      typeLine: 'Creature — Goblin Soldier',
    }),
    makeCard({
      scryfallId: 'hybrid-rw-u',
      name: 'Ruhan',
      manaCost: '{1}{R/W}{U}',
      colorIdentity: ['R', 'W', 'U'],
      typeLine: 'Creature — Giant',
    }),
    makeCard({
      scryfallId: 'nonhybrid-rw',
      name: 'Boros Charm',
      manaCost: '{R}{W}',
      colorIdentity: ['R', 'W'],
      typeLine: 'Instant',
    }),
    makeCard({
      scryfallId: 'phyrexian-g',
      name: 'Mutagenic Growth',
      manaCost: '{G/P}',
      colorIdentity: ['G'],
      typeLine: 'Instant',
    }),
    makeCard({
      scryfallId: 'hybrid-rw-phyrex-g',
      name: 'Hypothetical',
      manaCost: '{R/W}{G/P}',
      colorIdentity: ['R', 'W', 'G'],
      typeLine: 'Creature — Test',
    }),
    makeCard({
      scryfallId: 'mono-w',
      name: 'Savannah Lions',
      manaCost: '{W}',
      colorIdentity: ['W'],
      typeLine: 'Creature — Cat',
    }),
  ];

  function filterHybridPool(selectedColorFilters: string[]) {
    return filterPoolCards(hybridPool, {
      ...allFiltersOn,
      selectedColorFilters,
    });
  }

  function isVisible(selectedColorFilters: string[], scryfallId: string) {
    return filterHybridPool(selectedColorFilters).some((card) => card.scryfallId === scryfallId);
  }

  it('shows hybrid cards when either hybrid color is selected', () => {
    expect(isVisible(['W'], 'hybrid-rw')).toBe(true);
    expect(isVisible(['R'], 'hybrid-rw')).toBe(true);
  });

  it('hides hybrid cards when neither hybrid color is selected', () => {
    expect(isVisible(['U'], 'hybrid-rw')).toBe(false);
  });

  it('shows hybrid plus fixed cards when fixed and hybrid requirements are satisfied', () => {
    expect(isVisible(['W', 'U'], 'hybrid-rw-u')).toBe(true);
  });

  it('hides hybrid plus fixed cards when fixed color is missing', () => {
    expect(isVisible(['W'], 'hybrid-rw-u')).toBe(false);
  });

  it('hides hybrid plus fixed cards when hybrid color is missing', () => {
    expect(isVisible(['U'], 'hybrid-rw-u')).toBe(false);
  });

  it('keeps non-hybrid multicolor cards requiring all colors', () => {
    expect(isVisible(['W'], 'nonhybrid-rw')).toBe(false);
    expect(isVisible(['R', 'W'], 'nonhybrid-rw')).toBe(true);
  });

  it('uses identity fallback for Phyrexian-only cards', () => {
    expect(isVisible(['G'], 'phyrexian-g')).toBe(true);
    expect(isVisible(['R'], 'phyrexian-g')).toBe(false);
  });

  it('requires both Phyrexian fixed and hybrid colors when both are present', () => {
    expect(isVisible(['R', 'G'], 'hybrid-rw-phyrex-g')).toBe(true);
    expect(isVisible(['R'], 'hybrid-rw-phyrex-g')).toBe(false);
    expect(isVisible(['G'], 'hybrid-rw-phyrex-g')).toBe(false);
  });

  it('keeps mono-color filtering unchanged for cards with manaCost', () => {
    expect(isVisible(['W'], 'mono-w')).toBe(true);
    expect(isVisible(['R'], 'mono-w')).toBe(false);
  });

  it('shows all hybrid pool cards when all color filters are selected', () => {
    const result = filterHybridPool([...COLOR_FILTERS]);
    expect(result.map((card) => card.scryfallId)).toEqual(hybridPool.map((card) => card.scryfallId));
  });
});
