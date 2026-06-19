import type { BracketSlotView } from './types';
import {
  bracketColumnMergeBusX,
  bracketFinalMergeBusX,
  BRACKET_COL_GAP,
  BRACKET_FINALS_GAP,
} from './layoutBracket';

export type BracketConnectorKind = 'winners' | 'losers' | 'drop' | 'final' | 'reset';

export type BracketConnectorEdge = {
  id: string;
  fromSlotKey: string;
  toSlotKey: string;
  kind: BracketConnectorKind;
};

const KIND_ORDER: Record<BracketConnectorKind, number> = {
  winners: 0,
  drop: 1,
  losers: 2,
  final: 3,
  reset: 4,
};

function edgeSortKey(edge: BracketConnectorEdge) {
  const fromKey =
    edge.kind === 'final' && edge.fromSlotKey.startsWith('W')
      ? `0-${edge.fromSlotKey}`
      : edge.kind === 'final' && edge.fromSlotKey.startsWith('L')
        ? `1-${edge.fromSlotKey}`
        : edge.fromSlotKey;
  return `${KIND_ORDER[edge.kind]}-${fromKey}-${edge.toSlotKey}`;
}

export function isVirtualDropNode(slotKey: string) {
  return /^LW\d+$/.test(slotKey);
}

export function collectBracketConnectors(slots: BracketSlotView[]): BracketConnectorEdge[] {
  const slotByKey = new Map(slots.map((slot) => [slot.slotKey, slot]));
  const edges: BracketConnectorEdge[] = [];

  for (const slot of slots) {
    for (const source of [slot.source1, slot.source2]) {
      if (!source || source.type !== 'match') {
        continue;
      }

      if (slot.slotKey === 'RESET' && source.takes === 'loser') {
        continue;
      }

      const fromSlot = slotByKey.get(source.slotKey);
      if (!fromSlot) {
        continue;
      }

      if (source.takes === 'loser' && fromSlot.bracketSide === 'winners' && slot.bracketSide === 'losers') {
        const lwKey = `LW${fromSlot.slotKey.replace(/^W/, '')}`;
        edges.push({
          id: `${lwKey}-${slot.slotKey}`,
          fromSlotKey: lwKey,
          toSlotKey: slot.slotKey,
          kind: 'drop',
        });
        continue;
      }

      let kind: BracketConnectorKind;
      if (slot.slotKey === 'RESET') {
        kind = 'reset';
      } else if (slot.slotKey === 'FIN') {
        kind = 'final';
      } else if (source.takes === 'loser') {
        kind = 'drop';
      } else if (slot.bracketSide === 'losers') {
        kind = 'losers';
      } else {
        kind = 'winners';
      }

      edges.push({
        id: `${source.slotKey}-${source.takes}-${slot.slotKey}`,
        fromSlotKey: source.slotKey,
        toSlotKey: slot.slotKey,
        kind,
      });
    }
  }

  return edges.sort((a, b) => edgeSortKey(a).localeCompare(edgeSortKey(b)));
}

type Point = { x: number; y: number };

function centerRight(slot: { x: number; y: number }, nodeWidth: number, nodeHeight: number): Point {
  return { x: slot.x + nodeWidth, y: slot.y + nodeHeight / 2 };
}

function centerLeft(slot: { x: number; y: number }, nodeHeight: number): Point {
  return { x: slot.x, y: slot.y + nodeHeight / 2 };
}

function sameY(a: number, b: number) {
  return Math.abs(a - b) < 0.5;
}

export function mergeBusX(end: Point, kind: BracketConnectorKind) {
  return kind === 'final' ? bracketFinalMergeBusX(end.x) : bracketColumnMergeBusX(end.x);
}

export function mergeBusPath(start: Point, end: Point, kind: BracketConnectorKind): string {
  const busX = mergeBusX(end, kind);

  if (sameY(start.y, end.y)) {
    if (start.x <= busX) {
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    return `M ${start.x} ${start.y} L ${busX} ${start.y} L ${end.x} ${end.y}`;
  }

  return `M ${start.x} ${start.y} L ${busX} ${start.y} L ${busX} ${end.y} L ${end.x} ${end.y}`;
}

export function pathBusX(path: string): number | null {
  const match = path.match(/ L (\d+(?:\.\d+)?) \d+(?:\.\d+)? L \1 /);
  return match ? Number.parseFloat(match[1]) : null;
}

export function firstHorizontalDelta(path: string): number | null {
  const match = path.match(/^M (\d+(?:\.\d+)?) \d+(?:\.\d+)? L (\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[2]) - Number.parseFloat(match[1]);
}

export function resolveDropAnchor(
  _lwKey: string,
  to: { x: number; y: number },
  nodeHeight: number,
): Point {
  return { x: to.x - 44, y: to.y + nodeHeight / 2 };
}

export function buildConnectorPath(
  from: { x: number; y: number; bracketSide: string },
  to: { x: number; y: number; bracketSide: string; slotKey: string },
  kind: BracketConnectorKind,
  nodeWidth: number,
  nodeHeight: number,
  startOverride?: Point,
): string {
  const start = startOverride ?? centerRight(from, nodeWidth, nodeHeight);
  const end = centerLeft(to, nodeHeight);

  if (kind === 'drop' && startOverride) {
    if (sameY(start.y, end.y)) {
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    const busX = end.x - 16;
    return `M ${start.x} ${start.y} L ${busX} ${start.y} L ${busX} ${end.y} L ${end.x} ${end.y}`;
  }

  return mergeBusPath(start, end, kind);
}

export function connectorStroke(kind: BracketConnectorKind) {
  return {
    dashed: kind === 'reset',
  };
}

export { BRACKET_COL_GAP, BRACKET_FINALS_GAP };
