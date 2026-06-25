import { describe, expect, it } from 'vitest';
import { createCustom10PlayerBracket } from '@mtg-league/shared';
import {
  bracketColumnMergeBusX,
  bracketFinalMergeBusX,
  layoutBracketSlots,
} from '@/components/bracket/layoutBracket';
import {
  buildConnectorPath,
  collectBracketConnectors,
  firstHorizontalDelta,
  mergeBusPath,
  pathBusX,
  resolveDropAnchor,
} from '@/components/bracket/connectorEdges';
import { BRACKET_NODE_HEIGHT, BRACKET_NODE_WIDTH } from '@/components/bracket/layoutBracket';
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

describe('collectBracketConnectors', () => {
  it('matches the custom 10-player reference bracket edges', () => {
    const edges = collectBracketConnectors(buildCustom10Slots());

    expect(edges.map((edge) => `${edge.fromSlotKey}->${edge.toSlotKey}:${edge.kind}`)).toEqual([
      'W1->W3:winners',
      'W2->W4:winners',
      'W3->W5:winners',
      'W4->W5:winners',
      'LW1->L3:drop',
      'LW2->L4:drop',
      'LW3->L5:drop',
      'LW4->L6:drop',
      'LW5->L7:drop',
      'L1->L3:losers',
      'L2->L4:losers',
      'L3->L5:losers',
      'L4->L6:losers',
      'L5->L7:losers',
      'L6->L8:losers',
      'L7->L8:losers',
      'W5->FIN:final',
      'L8->FIN:final',
      'FIN->RESET:reset',
    ]);
  });

  it('does not draw cross-bracket lines from winners matches into losers matches', () => {
    const edges = collectBracketConnectors(buildCustom10Slots());
    expect(edges.some((edge) => edge.fromSlotKey.startsWith('W') && edge.toSlotKey.startsWith('L'))).toBe(false);
  });

  it('does not draw the duplicate FIN loser line into RESET', () => {
    const edges = collectBracketConnectors(buildCustom10Slots());
    expect(edges.some((edge) => edge.fromSlotKey === 'FIN' && edge.toSlotKey === 'RESET' && edge.kind === 'drop')).toBe(
      false,
    );
    expect(edges.filter((edge) => edge.toSlotKey === 'RESET')).toHaveLength(1);
  });
});

describe('buildConnectorPath', () => {
  it('routes winner connectors through the column gap merge bus', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const w2 = layout.slots.find((slot) => slot.slotKey === 'W2')!;
    const w5 = layout.slots.find((slot) => slot.slotKey === 'W5')!;

    const start = { x: w2.x + BRACKET_NODE_WIDTH, y: w2.y + BRACKET_NODE_HEIGHT / 2 };
    const end = { x: w5.x, y: w5.y + BRACKET_NODE_HEIGHT / 2 };
    const path = buildConnectorPath(w2, w5, 'winners', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);

    expect(path).toBe(mergeBusPath(start, end, 'winners'));
    expect(pathBusX(path)).toBe(bracketColumnMergeBusX(w5.x));
    expect(firstHorizontalDelta(path)).toBeGreaterThan(0);
  });

  it('routes adjacent-round feeders forward into the shared merge bus', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const w3 = layout.slots.find((slot) => slot.slotKey === 'W3')!;
    const w4 = layout.slots.find((slot) => slot.slotKey === 'W4')!;
    const w5 = layout.slots.find((slot) => slot.slotKey === 'W5')!;

    const w3Path = buildConnectorPath(w3, w5, 'winners', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);
    const w4Path = buildConnectorPath(w4, w5, 'winners', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);
    const busX = bracketColumnMergeBusX(w5.x);

    expect(pathBusX(w3Path)).toBe(busX);
    expect(pathBusX(w4Path)).toBe(busX);
    expect(firstHorizontalDelta(w3Path)).toBeGreaterThan(0);
    expect(firstHorizontalDelta(w4Path)).toBeGreaterThan(0);
  });

  it('routes drop connectors as a straight horizontal line from virtual LW anchors', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const l3 = layout.slots.find((slot) => slot.slotKey === 'L3')!;
    const start = resolveDropAnchor('LW1', l3, BRACKET_NODE_HEIGHT);
    const end = { x: l3.x, y: l3.y + BRACKET_NODE_HEIGHT / 2 };

    const path = buildConnectorPath(l3, l3, 'drop', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT, start);
    expect(path).toBe(`M ${start.x} ${start.y} L ${end.x} ${end.y}`);
    expect(start.x).toBeLessThan(l3.x);
  });

  it('merges bottom round 3 and round 4 feeders on one bus into round 5', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const l6 = layout.slots.find((slot) => slot.slotKey === 'L6')!;
    const l7 = layout.slots.find((slot) => slot.slotKey === 'L7')!;
    const l8 = layout.slots.find((slot) => slot.slotKey === 'L8')!;

    const l6Path = buildConnectorPath(l6, l8, 'losers', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);
    const l7Path = buildConnectorPath(l7, l8, 'losers', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);
    const busX = bracketColumnMergeBusX(l8.x);

    expect(pathBusX(l6Path)).toBe(busX);
    expect(pathBusX(l7Path)).toBe(busX);
    expect(firstHorizontalDelta(l6Path)).toBeGreaterThan(0);
    expect(firstHorizontalDelta(l7Path)).toBeGreaterThan(0);
  });

  it('routes grand-final inputs through the finals gap merge bus', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const w5 = layout.slots.find((slot) => slot.slotKey === 'W5')!;
    const l8 = layout.slots.find((slot) => slot.slotKey === 'L8')!;
    const fin = layout.slots.find((slot) => slot.slotKey === 'FIN')!;

    const w5Path = buildConnectorPath(w5, fin, 'final', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);
    const l8Path = buildConnectorPath(l8, fin, 'final', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);

    expect(pathBusX(w5Path)).toBe(bracketFinalMergeBusX(fin.x));
    expect(pathBusX(l8Path)).toBe(bracketFinalMergeBusX(fin.x));
  });

  it('routes FIN to RESET as a straight horizontal line', () => {
    const layout = layoutBracketSlots(buildCustom10Slots());
    const fin = layout.slots.find((slot) => slot.slotKey === 'FIN')!;
    const reset = layout.slots.find((slot) => slot.slotKey === 'RESET')!;

    const path = buildConnectorPath(fin, reset, 'reset', BRACKET_NODE_WIDTH, BRACKET_NODE_HEIGHT);
    expect(path).toBe(
      `M ${fin.x + BRACKET_NODE_WIDTH} ${fin.y + BRACKET_NODE_HEIGHT / 2} L ${reset.x} ${reset.y + BRACKET_NODE_HEIGHT / 2}`,
    );
  });
});
