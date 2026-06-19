import { describe, expect, it } from 'vitest';
import { createCustom10PlayerBracket } from '@mtg-league/shared';
import {
  BRACKET_FINALS_GAP,
  BRACKET_FINALS_PAIR_GAP,
  BRACKET_NODE_HEIGHT,
  BRACKET_NODE_WIDTH,
  BRACKET_ROW_GAP,
  buildBracketMatchLabels,
  layoutBracketSlots,
  slotDisplayLabel,
} from '@/components/bracket/layoutBracket';
import type { BracketSlotView } from '@/components/bracket/types';

function buildCustom10Slots(): BracketSlotView[] {
  return createCustom10PlayerBracket().slots.map((slot) => ({
    id: `slot-${slot.slotKey}`,
    slotKey: slot.slotKey,
    bracketSide: slot.bracketSide,
    bracketRound: slot.bracketRound,
    col: slot.col,
    row: slot.row,
    source1: slot.source1,
    source2: slot.source2,
    player1: null,
    player2: null,
    winnerId: null,
    match: null,
  }));
}

function verticalOverlap(a: { y: number }, b: { y: number }) {
  return Math.abs(a.y - b.y) < BRACKET_NODE_HEIGHT + 4;
}

describe('layoutBracketSlots', () => {
  it('separates top and bottom brackets into distinct vertical sections', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());

    const top = layout.slots.filter((slot) => slot.bracketSide === 'winners');
    const bottom = layout.slots.filter((slot) => slot.bracketSide === 'losers');

    expect(top.length).toBeGreaterThan(0);
    expect(bottom.length).toBeGreaterThan(0);

    const maxTopBottom = Math.max(...top.map((slot) => slot.y)) + BRACKET_NODE_HEIGHT;
    const minBottomTop = Math.min(...bottom.map((slot) => slot.y));
    expect(minBottomTop).toBeGreaterThan(maxTopBottom);
  });

  it('uses top and bottom labels for section headers', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());

    expect(layout.sections.find((section) => section.id === 'winners')?.label).toBe('Top Bracket');
    expect(layout.sections.find((section) => section.id === 'losers')?.label).toBe('Bottom Bracket');
    expect(layout.sections.find((section) => section.id === 'finals')?.showLabel).toBe(false);
  });

  it('does not overlap top round-one matches vertically', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const roundOne = layout.slots.filter((slot) => slot.bracketSide === 'winners' && slot.bracketRound === 1);

    expect(roundOne).toHaveLength(2);
    expect(verticalOverlap(roundOne[0], roundOne[1])).toBe(false);
    expect(Math.abs(roundOne[0].y - roundOne[1].y)).toBeGreaterThanOrEqual(BRACKET_NODE_HEIGHT + BRACKET_ROW_GAP - 1);
  });

  it('places grand finals adjacent to the right edge of the main bracket', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const finals = layout.slots.filter((slot) => slot.bracketSide === 'finals');
    const main = layout.slots.filter((slot) => slot.bracketSide !== 'finals');
    const fin = finals.find((slot) => slot.slotKey === 'FIN');
    const reset = finals.find((slot) => slot.slotKey === 'RESET');
    const rightmostMainRight = Math.max(...main.map((slot) => slot.x + BRACKET_NODE_WIDTH));

    expect(finals.length).toBeGreaterThan(0);
    expect(fin).toBeDefined();
    expect(reset).toBeDefined();
    expect(fin!.x).toBe(rightmostMainRight + BRACKET_FINALS_GAP);
    expect(reset!.x).toBe(fin!.x + BRACKET_NODE_WIDTH + BRACKET_FINALS_PAIR_GAP);
    expect(fin!.y).toBe(reset!.y);
  });

  it('centers grand finals vertically between the top and bottom brackets', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const top = layout.slots.filter((slot) => slot.bracketSide === 'winners');
    const bottom = layout.slots.filter((slot) => slot.bracketSide === 'losers');
    const fin = layout.slots.find((slot) => slot.slotKey === 'FIN')!;

    const topBracketBottom = Math.max(...top.map((slot) => slot.y + BRACKET_NODE_HEIGHT));
    const bottomBracketTop = Math.min(...bottom.map((slot) => slot.y));
    const expectedCenterY = (topBracketBottom + bottomBracketTop) / 2;

    expect(fin.y + BRACKET_NODE_HEIGHT / 2).toBeCloseTo(expectedCenterY, 5);
  });

  it('assigns a unique human-readable match label to every slot', () => {
    const slots = buildCustom10Slots();
    const layout = layoutBracketSlots(slots);
    const matchLabels = buildBracketMatchLabels(slots);
    const w1 = layout.slots.find((slot) => slot.slotKey === 'W1')!;
    const w2 = layout.slots.find((slot) => slot.slotKey === 'W2')!;
    const fin = layout.slots.find((slot) => slot.slotKey === 'FIN')!;

    expect(slotDisplayLabel(w2, matchLabels)).toBe('Match 1');
    expect(slotDisplayLabel(w1, matchLabels)).toBe('Match 2');
    expect(slotDisplayLabel(fin, matchLabels)).toBe('Match 14');
    expect(new Set(matchLabels.values()).size).toBe(slots.length);
    expect(slotDisplayLabel(w1, matchLabels)).not.toBe(slotDisplayLabel(w2, matchLabels));
  });

  it('keeps section headers above their bracket content', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const topSection = layout.sections.find((section) => section.id === 'winners');
    const top = layout.slots.filter((slot) => slot.bracketSide === 'winners');

    expect(topSection).toBeDefined();
    expect(Math.min(...top.map((slot) => slot.y))).toBeGreaterThanOrEqual(topSection!.top + 32);
  });
});
