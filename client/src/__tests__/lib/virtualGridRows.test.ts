import { describe, expect, it } from 'vitest';
import type { PoolCard } from '@/components/cardpool/types';
import {
  buildVirtualGridRows,
  computeGridCellWidth,
  computeGridColumnCount,
  computeWindowScrollMargin,
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

  it('chunks mana-value groups into section headers then card rows', () => {
    const rows = buildVirtualGridRows(mixedTypeCards, {
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'cmc',
      columnCount: 2,
    });

    expect(rows.map((row) => row.kind).every((kind) => kind === 'section-header' || kind === 'card-row')).toBe(
      true,
    );

    for (const [index, row] of rows.entries()) {
      if (row.kind === 'section-header') {
        expect(rows[index + 1]?.kind).toBe('card-row');
        expect('cards' in row).toBe(false);
      }
      if (row.kind === 'card-row') {
        expect(row.cards.length).toBeGreaterThan(0);
        expect(row.cards.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('keeps phase headers ahead of section headers and card rows', () => {
    const phaseCards = [
      makeCard({
        scryfallId: 'bolt',
        name: 'Lightning Bolt',
        typeLine: 'Instant',
        cmc: 1,
        phaseLabel: 'Initial Pool',
        phaseQuantities: { 'Initial Pool': 1 },
      }),
      makeCard({
        scryfallId: 'shock',
        name: 'Shock',
        typeLine: 'Instant',
        cmc: 1,
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

    expect(rows.map((row) => row.kind)).toEqual([
      'phase-header',
      'section-header',
      'card-row',
      'phase-header',
      'section-header',
      'card-row',
    ]);
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

describe('computeGridCellWidth', () => {
  it('returns stretched cell width for 800px container and 3 columns', () => {
    const cellWidth = computeGridCellWidth(800, 3, 8);
    expect(cellWidth).toBe((800 - 16) / 3);
    expect(cellWidth).not.toBe(200);
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

  it('estimates card rows from cell width rather than slider width', () => {
    const cellWidth = computeGridCellWidth(800, 3, 8);
    const cellEstimate = estimateVirtualGridRowHeight({ kind: 'card-row', id: 'row', cards: [] }, cellWidth);
    const sliderEstimate = estimateVirtualGridRowHeight({ kind: 'card-row', id: 'row', cards: [] }, 200);

    expect(cellEstimate).toBe(Math.round(cellWidth * (680 / 488)) + 8);
    expect(cellEstimate).toBeGreaterThan(sliderEstimate);
  });
});

describe('computeWindowScrollMargin', () => {
  it('uses bounding rect top plus scrollY when the grid is flush with the viewport', () => {
    const element = {
      getBoundingClientRect: () => ({ top: 0 }),
      offsetTop: 48,
    } as HTMLElement;

    expect(computeWindowScrollMargin(element, 800)).toBe(800);
  });

  it('uses bounding rect top when the page has not scrolled', () => {
    const element = {
      getBoundingClientRect: () => ({ top: 400 }),
      offsetTop: 48,
    } as HTMLElement;

    expect(computeWindowScrollMargin(element, 0)).toBe(400);
  });

  it('returns 0 when the element is missing', () => {
    expect(computeWindowScrollMargin(null, 800)).toBe(0);
  });
});
