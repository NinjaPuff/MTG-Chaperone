import { describe, expect, it } from 'vitest';
import type { PoolCard } from '@/components/cardpool/types';
import {
  buildVirtualGridRows,
  computeGridColumnCount,
  estimateVirtualGridRowHeight,
} from '../../lib/virtualGridRows';

function makeCard(overrides: Partial<PoolCard> & Pick<PoolCard, 'scryfallId' | 'name' | 'typeLine'>): PoolCard {
  return {
    layout: null,
    manaCost: null,
    rarity: 'common',
    setCode: 'TST',
    imageUris: null,
    cmc: 0,
    colors: [],
    colorIdentity: [],
    quantity: 1,
    phaseLabel: 'Initial Pool',
    phaseQuantities: { 'Initial Pool': 1 },
    ...overrides,
  };
}

describe('computeGridColumnCount', () => {
  it('returns 3 columns for 800px container and 220px cards', () => {
    expect(computeGridColumnCount(800, 220, 8)).toBe(3);
  });

  it('returns 1 column when container matches card width', () => {
    expect(computeGridColumnCount(220, 220, 8)).toBe(1);
  });

  it('returns 1 column for zero-width container', () => {
    expect(computeGridColumnCount(0, 220, 8)).toBe(1);
  });

  it('returns 7 columns for 1200px container and 160px cards', () => {
    expect(computeGridColumnCount(1200, 160, 8)).toBe(7);
  });
});

describe('buildVirtualGridRows', () => {
  const mixedTypeCards = [
    makeCard({ scryfallId: 'bolt', name: 'Lightning Bolt', typeLine: 'Instant', cmc: 1 }),
    makeCard({ scryfallId: 'shock', name: 'Shock', typeLine: 'Instant', cmc: 1 }),
    makeCard({ scryfallId: 'bear', name: 'Grizzly Bears', typeLine: 'Creature — Bear', cmc: 2 }),
    makeCard({ scryfallId: 'elf', name: 'Llanowar Elves', typeLine: 'Creature — Elf Druid', cmc: 1 }),
    makeCard({ scryfallId: 'giant', name: 'Hill Giant', typeLine: 'Creature — Giant', cmc: 4 }),
  ];

  it('returns empty array for no cards', () => {
    expect(
      buildVirtualGridRows([], {
        sortKey: 'type',
        groupMode: 'flat',
        organizeBy: 'type',
        columnCount: 3,
      }),
    ).toEqual([]);
  });

  it('chunks flat/type groups into section headers and card rows', () => {
    const rows = buildVirtualGridRows(mixedTypeCards, {
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      columnCount: 3,
    });

    expect(rows.map((row) => row.kind)).toEqual([
      'section-header',
      'card-row',
      'section-header',
      'card-row',
    ]);

    const creatureHeader = rows.find((row) => row.kind === 'section-header' && row.label === 'Creature');
    expect(creatureHeader).toMatchObject({ kind: 'section-header', count: 3 });

    const instantHeader = rows.find((row) => row.kind === 'section-header' && row.label === 'Instant');
    expect(instantHeader).toMatchObject({ kind: 'section-header', count: 2 });

    const instantRow = rows.find((row) => row.kind === 'card-row' && row.cards.some((card) => card.scryfallId === 'bolt'));
    expect(instantRow?.kind).toBe('card-row');
    if (instantRow?.kind === 'card-row') {
      expect(instantRow.cards).toHaveLength(2);
    }

    const creatureRow = rows.find((row) => row.kind === 'card-row' && row.cards.some((card) => card.scryfallId === 'bear'));
    expect(creatureRow?.kind).toBe('card-row');
    if (creatureRow?.kind === 'card-row') {
      expect(creatureRow.cards).toHaveLength(3);
    }
  });

  it('supports partial last row when fewer cards than columns', () => {
    const rows = buildVirtualGridRows([mixedTypeCards[0]], {
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      columnCount: 4,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'section-header', label: 'Instant', count: 1 });
    expect(rows[1]?.kind).toBe('card-row');
    if (rows[1]?.kind === 'card-row') {
      expect(rows[1].cards).toHaveLength(1);
    }
  });

  it('inserts phase headers before each phase section group', () => {
    const phaseCards = [
      makeCard({
        scryfallId: 'bolt',
        name: 'Lightning Bolt',
        typeLine: 'Instant',
        phaseLabel: 'Initial Pool',
        phaseQuantities: { 'Initial Pool': 1 },
      }),
      makeCard({
        scryfallId: 'shock',
        name: 'Shock',
        typeLine: 'Instant',
        phaseLabel: 'Event 1',
        phaseQuantities: { 'Event 1': 1 },
      }),
    ];

    const rows = buildVirtualGridRows(phaseCards, {
      sortKey: 'name',
      groupMode: 'phase',
      organizeBy: 'type',
      columnCount: 3,
    });

    expect(rows.filter((row) => row.kind === 'phase-header')).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'phase-header', label: 'Initial Pool' });
    expect(rows.some((row) => row.kind === 'phase-header' && row.label === 'Event 1')).toBe(true);
  });
});

describe('estimateVirtualGridRowHeight', () => {
  it('returns fixed heights for headers', () => {
    expect(
      estimateVirtualGridRowHeight({ kind: 'phase-header', id: 'phase', label: 'Initial Pool' }, 220),
    ).toBe(36);
    expect(
      estimateVirtualGridRowHeight(
        { kind: 'section-header', id: 'section', label: 'Creature', count: 3 },
        220,
      ),
    ).toBe(28);
  });

  it('returns card row height from card width and aspect ratio', () => {
    expect(
      estimateVirtualGridRowHeight({ kind: 'card-row', id: 'row', cards: [] }, 220),
    ).toBe(Math.round(220 * (680 / 488)) + 8);
  });
});
