import { describe, expect, it } from 'vitest';
import type { PoolCard } from '../../components/cardpool/types';
import {
  flattenEntries,
  getImageUrl,
  getPrimaryType,
  groupByCmc,
  groupByOrganize,
  groupByType,
  sortCards,
} from '../../lib/cardPoolSort';

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

describe('cardPoolSort helpers', () => {
  it('extracts primary type using the left-side final word', () => {
    expect(getPrimaryType('Legendary Creature — Human Wizard')).toBe('Creature');
    expect(getPrimaryType('Artifact')).toBe('Artifact');
    expect(getPrimaryType('Unknown Thing')).toBe('Other');
  });

  it('sorts by cmc then color then name', () => {
    const cards = [
      makeCard({ name: 'Zulu', cmc: 2, colors: ['U'] }),
      makeCard({ name: 'Alpha', cmc: 1, colors: ['R'] }),
      makeCard({ name: 'Beta', cmc: 2, colors: ['W'] }),
    ];

    const sorted = sortCards(cards, 'cmc');
    expect(sorted.map((card) => card.name)).toEqual(['Alpha', 'Beta', 'Zulu']);
  });

  it('groups by type using the configured type order', () => {
    const cards = [
      makeCard({ name: 'Island', typeLine: 'Basic Land — Island' }),
      makeCard({ name: 'Shock', typeLine: 'Instant' }),
      makeCard({ name: 'Bear', typeLine: 'Creature — Bear' }),
    ];
    const grouped = groupByType(cards);
    expect([...grouped.keys()]).toEqual(['Creature', 'Instant', 'Land']);
    expect(grouped.get('Creature')?.[0].name).toBe('Bear');
  });

  it('groups cards into cmc buckets including 7+', () => {
    const cards = [
      makeCard({ name: 'Zero', cmc: 0 }),
      makeCard({ name: 'Two', cmc: 2 }),
      makeCard({ name: 'Eight', cmc: 8 }),
    ];
    const grouped = groupByCmc(cards);
    expect(grouped.get(0)?.map((card) => card.name)).toEqual(['Zero']);
    expect(grouped.get(2)?.map((card) => card.name)).toEqual(['Two']);
    expect(grouped.get(7)?.map((card) => card.name)).toEqual(['Eight']);
  });

  it('flattens entries by scryfall id in flat mode', () => {
    const acquisitions = [
      {
        phaseLabel: 'Initial Pool',
        entries: [
          {
            quantity: 1,
            cachedCard: {
              scryfallId: 'a',
              name: 'Island',
              layout: null,
              manaCost: null,
              typeLine: 'Basic Land — Island',
              rarity: 'common',
              setCode: 'ABC',
              imageUris: { small: 'small-a' },
              cmc: 0,
              colors: [],
            },
          },
        ],
      },
      {
        phaseLabel: 'After Round 1',
        entries: [
          {
            quantity: 2,
            cachedCard: {
              scryfallId: 'a',
              name: 'Island',
              layout: null,
              manaCost: null,
              typeLine: 'Basic Land — Island',
              rarity: 'common',
              setCode: 'ABC',
              imageUris: { small: 'small-a' },
              cmc: 0,
              colors: [],
            },
          },
        ],
      },
    ];

    const cards = flattenEntries(acquisitions, 'flat');
    expect(cards).toHaveLength(1);
    expect(cards[0].quantity).toBe(3);
    expect(cards[0].phaseQuantities).toEqual({ 'Phase 1': 1, 'Phase 2': 2 });
  });

  it('keeps separate phase rows in phase mode', () => {
    const acquisitions = [
      {
        phaseLabel: 'Initial Pool',
        entries: [
          {
            quantity: 1,
            cachedCard: {
              scryfallId: 'a',
              name: 'Island',
              layout: null,
              manaCost: null,
              typeLine: 'Basic Land — Island',
              rarity: 'common',
              setCode: 'ABC',
              imageUris: null,
              cmc: 0,
              colors: [],
            },
          },
        ],
      },
      {
        phaseLabel: 'After Round 1',
        entries: [
          {
            quantity: 1,
            cachedCard: {
              scryfallId: 'a',
              name: 'Island',
              layout: null,
              manaCost: null,
              typeLine: 'Basic Land — Island',
              rarity: 'common',
              setCode: 'ABC',
              imageUris: null,
              cmc: 0,
              colors: [],
            },
          },
        ],
      },
    ];

    const cards = flattenEntries(acquisitions, 'phase');
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.phaseLabel)).toEqual(['Phase 1', 'Phase 2']);
  });

  it('groups creature_split into Creatures and Non-Creatures buckets', () => {
    const cards = [
      makeCard({ name: 'Bear', typeLine: 'Creature — Bear', cmc: 3, quantity: 2 }),
      makeCard({ name: 'Shock', typeLine: 'Sorcery', cmc: 3, quantity: 1 }),
    ];
    const groups = groupByOrganize(cards, 'creature_split');

    expect(groups.get('Creatures')).toHaveLength(1);
    expect(groups.get('Creatures')?.reduce((sum, card) => sum + card.quantity, 0)).toBe(2);
    expect(groups.get('Non-Creatures')).toHaveLength(1);
    expect(groups.get('Non-Creatures')?.reduce((sum, card) => sum + card.quantity, 0)).toBe(1);
  });

  it('classifies Artifact Creature as Creatures in creature_split', () => {
    const cards = [makeCard({ name: 'Golem', typeLine: 'Artifact Creature — Golem', cmc: 4, quantity: 1 })];
    const groups = groupByOrganize(cards, 'creature_split');

    expect(groups.get('Creatures')).toHaveLength(1);
    expect(groups.get('Non-Creatures')).toBeUndefined();
  });

  it('returns null when requested image size is unavailable', () => {
    const card = makeCard({ imageUris: { normal: 'normal-image' } });
    expect(getImageUrl(card, 'normal')).toBe('normal-image');
    expect(getImageUrl(card, 'small')).toBeNull();
  });
});
