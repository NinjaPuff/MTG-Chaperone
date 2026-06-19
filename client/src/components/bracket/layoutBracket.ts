import type { BracketSlotView } from './types';

export const BRACKET_NODE_WIDTH = 236;
export const BRACKET_PARTICIPANT_ROW_HEIGHT = 44;
export const BRACKET_NODE_HEADER_BLOCK = 18;
export const BRACKET_NODE_FOOTER_BLOCK = 18;
export const BRACKET_NODE_VERTICAL_PADDING = 16;
export const BRACKET_NODE_HEIGHT =
  BRACKET_NODE_VERTICAL_PADDING +
  BRACKET_NODE_HEADER_BLOCK +
  BRACKET_PARTICIPANT_ROW_HEIGHT * 2 +
  BRACKET_NODE_FOOTER_BLOCK +
  8;

export function bracketColumnMergeBusX(targetLeftX: number) {
  return targetLeftX - BRACKET_COL_GAP / 2;
}

export function bracketFinalMergeBusX(targetLeftX: number) {
  return targetLeftX - BRACKET_FINALS_GAP / 2;
}
export const BRACKET_ROW_GAP = 48;
export const BRACKET_COL_WIDTH = 284;
export const BRACKET_COL_GAP = BRACKET_COL_WIDTH - BRACKET_NODE_WIDTH;
export const BRACKET_SECTION_HEADER = 32;
export const BRACKET_SECTION_GAP = 48;
export const BRACKET_FINALS_GAP = 40;
export const BRACKET_FINALS_PAIR_GAP = 24;

export type PositionedSlot = BracketSlotView & { x: number; y: number };

export type BracketSectionLayout = {
  id: string;
  label: string;
  top: number;
  width: number;
  height: number;
  showLabel?: boolean;
};

export type BracketLayout = {
  sections: BracketSectionLayout[];
  slots: PositionedSlot[];
  width: number;
  height: number;
};

function rowHeight() {
  return BRACKET_NODE_HEIGHT + BRACKET_ROW_GAP;
}

function sectionWidth(sectionSlots: BracketSlotView[]) {
  if (sectionSlots.length === 0) {
    return 0;
  }
  return Math.max(...sectionSlots.map((slot) => slot.col)) * BRACKET_COL_WIDTH + BRACKET_NODE_WIDTH + 24;
}

function refineVerticalCentering(slots: PositionedSlot[]) {
  const byKey = new Map(slots.map((slot) => [slot.slotKey, slot]));

  for (const slot of slots) {
    const matchSources = [slot.source1, slot.source2].filter(
      (source): source is Extract<BracketSlotView['source1'], { type: 'match' }> => source?.type === 'match',
    );
    if (matchSources.length !== 2) {
      continue;
    }

    const sourceA = byKey.get(matchSources[0].slotKey);
    const sourceB = byKey.get(matchSources[1].slotKey);
    if (!sourceA || !sourceB || sourceA.bracketSide !== sourceB.bracketSide) {
      continue;
    }

    slot.y = (sourceA.y + sourceB.y) / 2;
  }
}

function placeSection(
  id: string,
  label: string,
  sectionSlots: BracketSlotView[],
  top: number,
): { section: BracketSectionLayout; slots: PositionedSlot[]; nextTop: number } {
  const contentTop = top + BRACKET_SECTION_HEADER;
  const positioned = sectionSlots.map((slot) => ({
    ...slot,
    x: 8 + (slot.col - 1) * BRACKET_COL_WIDTH,
    y: contentTop + (slot.row - 1) * rowHeight(),
  }));

  refineVerticalCentering(positioned);

  const bottom = positioned.length > 0 ? Math.max(...positioned.map((slot) => slot.y)) + BRACKET_NODE_HEIGHT : contentTop;
  const section: BracketSectionLayout = {
    id,
    label,
    top,
    width: sectionWidth(sectionSlots),
    height: bottom - top,
  };

  return {
    section,
    slots: positioned,
    nextTop: bottom + BRACKET_SECTION_GAP,
  };
}

export function layoutBracketSlots(slots: BracketSlotView[]): BracketLayout {
  const winners = slots.filter((slot) => slot.bracketSide === 'winners');
  const losers = slots.filter((slot) => slot.bracketSide === 'losers');
  const finals = slots.filter((slot) => slot.bracketSide === 'finals');

  const sections: BracketSectionLayout[] = [];
  const positioned: PositionedSlot[] = [];
  let top = 0;

  if (winners.length > 0) {
    const winnersLayout = placeSection('winners', 'Top Bracket', winners, top);
    sections.push(winnersLayout.section);
    positioned.push(...winnersLayout.slots);
    top = winnersLayout.nextTop;
  }

  if (losers.length > 0) {
    const losersLayout = placeSection('losers', 'Bottom Bracket', losers, top);
    sections.push(losersLayout.section);
    positioned.push(...losersLayout.slots);
    top = losersLayout.nextTop;
  }

  if (finals.length > 0) {
    const winnersSection = sections.find((section) => section.id === 'winners');
    const losersSection = sections.find((section) => section.id === 'losers');
    const winnersSlots = positioned.filter((slot) => slot.bracketSide === 'winners');
    const losersSlots = positioned.filter((slot) => slot.bracketSide === 'losers');

    const topBracketBottom =
      winnersSlots.length > 0 ? Math.max(...winnersSlots.map((slot) => slot.y + BRACKET_NODE_HEIGHT)) : 0;
    const bottomBracketTop = losersSlots.length > 0 ? Math.min(...losersSlots.map((slot) => slot.y)) : topBracketBottom;
    const finalsCenterY =
      winnersSlots.length > 0 && losersSlots.length > 0
        ? (topBracketBottom + bottomBracketTop) / 2
        : topBracketBottom;
    const finalsY = finalsCenterY - BRACKET_NODE_HEIGHT / 2;

    const rightmostMainRight = Math.max(
      ...positioned
        .filter((slot) => slot.bracketSide !== 'finals')
        .map((slot) => slot.x + BRACKET_NODE_WIDTH),
      0,
    );

    const orderedFinals = [...finals].sort((a, b) => a.bracketRound - b.bracketRound);
    const finalsSlots: PositionedSlot[] = orderedFinals.map((slot, index) => ({
      ...slot,
      x: rightmostMainRight + BRACKET_FINALS_GAP + index * (BRACKET_NODE_WIDTH + BRACKET_FINALS_PAIR_GAP),
      y: finalsY,
    }));

    const finalsRight =
      rightmostMainRight +
      BRACKET_FINALS_GAP +
      orderedFinals.length * BRACKET_NODE_WIDTH +
      Math.max(0, orderedFinals.length - 1) * BRACKET_FINALS_PAIR_GAP;

    sections.push({
      id: 'finals',
      label: 'Grand Finals',
      top: winnersSection?.top ?? losersSection?.top ?? 0,
      width: finalsRight + 16,
      height: Math.max(winnersSection?.height ?? 0, losersSection?.height ?? 0, rowHeight() + BRACKET_SECTION_HEADER),
      showLabel: false,
    });
    positioned.push(...finalsSlots);
  }

  const width = Math.max(
    ...sections.map((section) => section.width),
    ...positioned.map((slot) => slot.x + BRACKET_NODE_WIDTH + 16),
    320,
  );
  const height = Math.max(...positioned.map((slot) => slot.y + BRACKET_NODE_HEIGHT + 16), 240);

  return { sections, slots: positioned, width, height };
}

const BRACKET_SIDE_ORDER: Record<string, number> = {
  winners: 0,
  losers: 1,
  finals: 2,
};

export function buildBracketMatchLabels(
  slots: Pick<BracketSlotView, 'slotKey' | 'bracketSide' | 'col' | 'row'>[],
): Map<string, string> {
  const sorted = [...slots].sort((a, b) => {
    const sideA = BRACKET_SIDE_ORDER[a.bracketSide] ?? 99;
    const sideB = BRACKET_SIDE_ORDER[b.bracketSide] ?? 99;
    if (sideA !== sideB) {
      return sideA - sideB;
    }
    if (a.col !== b.col) {
      return a.col - b.col;
    }
    if (a.row !== b.row) {
      return a.row - b.row;
    }
    return a.slotKey.localeCompare(b.slotKey);
  });

  const labels = new Map<string, string>();
  sorted.forEach((slot, index) => {
    labels.set(slot.slotKey, `Match ${index + 1}`);
  });
  return labels;
}

export function slotDisplayLabel(
  slot: Pick<BracketSlotView, 'slotKey' | 'bracketSide' | 'bracketRound' | 'row'>,
  matchLabels?: Map<string, string>,
) {
  if (matchLabels?.has(slot.slotKey)) {
    return matchLabels.get(slot.slotKey)!;
  }

  return slot.slotKey;
}
