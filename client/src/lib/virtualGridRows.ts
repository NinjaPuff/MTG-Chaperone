import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from '@/components/cardpool/types';
import { groupByOrganize, groupByPhase, sortCards } from '@/lib/cardPoolSort';

export const GRID_GAP_PX = 8;
export const CARD_ASPECT_HEIGHT_RATIO = 680 / 488;
export const PHASE_HEADER_HEIGHT_PX = 36;
export const SECTION_HEADER_HEIGHT_PX = 28;

export type VirtualGridRow =
  | { kind: 'phase-header'; id: string; label: string }
  | { kind: 'section-header'; id: string; label: string; count: number }
  | { kind: 'card-row'; id: string; cards: PoolCard[] };

export function computeGridColumnCount(
  containerWidth: number,
  cardWidth: number,
  gapPx: number = GRID_GAP_PX,
): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return 1;
  }
  if (!Number.isFinite(cardWidth) || cardWidth <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor((containerWidth + gapPx) / (cardWidth + gapPx)));
}

export function computeGridCellWidth(
  containerWidth: number,
  columnCount: number,
  gapPx: number = GRID_GAP_PX,
): number {
  const columns = Math.max(1, columnCount);
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return 0;
  }
  return (containerWidth - gapPx * (columns - 1)) / columns;
}

export function computeWindowScrollMargin(element: HTMLElement | null, scrollY: number): number {
  if (!element) {
    return 0;
  }
  return element.getBoundingClientRect().top + scrollY;
}

function chunkCards(cards: PoolCard[], columnCount: number): PoolCard[][] {
  const rows: PoolCard[][] = [];
  for (let index = 0; index < cards.length; index += columnCount) {
    rows.push(cards.slice(index, index + columnCount));
  }
  return rows;
}

function buildOrganizedRows(
  cards: PoolCard[],
  opts: {
    sortKey: SortKey;
    organizeBy: StacksOrganizeBy;
    columnCount: number;
    idPrefix: string;
  },
): VirtualGridRow[] {
  const groups = groupByOrganize(cards, opts.organizeBy);
  const rows: VirtualGridRow[] = [];

  for (const [label, groupedCards] of groups.entries()) {
    const sorted = sortCards(groupedCards, opts.sortKey);
    const count = sorted.reduce((sum, card) => sum + card.quantity, 0);
    rows.push({
      kind: 'section-header',
      id: `${opts.idPrefix}section:${label}`,
      label,
      count,
    });

    for (const [rowIndex, rowCards] of chunkCards(sorted, opts.columnCount).entries()) {
      rows.push({
        kind: 'card-row',
        id: `${opts.idPrefix}row:${label}:${rowIndex}`,
        cards: rowCards,
      });
    }
  }

  return rows;
}

export function buildVirtualGridRows(
  cards: PoolCard[],
  opts: {
    sortKey: SortKey;
    groupMode: GroupMode;
    organizeBy: StacksOrganizeBy;
    columnCount: number;
  },
): VirtualGridRow[] {
  if (cards.length === 0) {
    return [];
  }

  const columnCount = Math.max(1, opts.columnCount);

  if (opts.groupMode === 'flat') {
    return buildOrganizedRows(cards, {
      sortKey: opts.sortKey,
      organizeBy: opts.organizeBy,
      columnCount,
      idPrefix: 'flat:',
    });
  }

  const byPhase = groupByPhase(cards);
  const rows: VirtualGridRow[] = [];

  for (const [phase, phaseCards] of byPhase.entries()) {
    rows.push({
      kind: 'phase-header',
      id: `phase:${phase}`,
      label: phase,
    });
    rows.push(
      ...buildOrganizedRows(phaseCards, {
        sortKey: opts.sortKey,
        organizeBy: opts.organizeBy,
        columnCount,
        idPrefix: `phase:${phase}:`,
      }),
    );
  }

  return rows;
}

export function estimateVirtualGridRowHeight(
  row: VirtualGridRow,
  cardWidth: number,
  gapPx: number = GRID_GAP_PX,
): number {
  if (row.kind === 'phase-header') {
    return PHASE_HEADER_HEIGHT_PX;
  }
  if (row.kind === 'section-header') {
    return SECTION_HEADER_HEIGHT_PX;
  }
  return Math.round(cardWidth * CARD_ASPECT_HEIGHT_RATIO) + gapPx;
}
