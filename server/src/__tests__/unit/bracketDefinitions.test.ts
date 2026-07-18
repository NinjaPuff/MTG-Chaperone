import { describe, expect, it } from 'vitest';
import {
  createCustom10PlayerBracket,
  createDoubleElimBracket,
  createSingleElimBracket,
  getBracketDefinition,
  getDownstreamSlots,
  getReadySlots,
  isBracketFormat,
  isPairingFormat,
  isSwissFormat,
  supportsRegeneratePairings,
} from '@mtg-league/shared';

function slotMap(definition: { slots: Array<{ slotKey: string }> }) {
  return new Map(definition.slots.map((slot) => [slot.slotKey, slot]));
}

describe('createSingleElimBracket', () => {
  it('creates expected slot counts for power-of-two fields', () => {
    expect(createSingleElimBracket(2).slots).toHaveLength(1);
    expect(createSingleElimBracket(4).slots).toHaveLength(3);
    expect(createSingleElimBracket(8).slots).toHaveLength(7);
  });

  it('creates byes for non-power-of-two fields', () => {
    const definition = createSingleElimBracket(6);
    expect(definition.slots).toHaveLength(5);
    const w3 = slotMap(definition).get('W3') as { source1: { type: string; seedNum: number } };
    const w4 = slotMap(definition).get('W4') as { source1: { type: string; seedNum: number } };
    expect(w3.source1).toEqual({ type: 'seed', seedNum: 1 });
    expect(w4.source1).toEqual({ type: 'seed', seedNum: 2 });
  });

  it('throws for unsupported player counts', () => {
    expect(() => createSingleElimBracket(1)).toThrow();
    expect(() => createSingleElimBracket(17)).toThrow();
  });
});

describe('createDoubleElimBracket', () => {
  it('creates winner, loser, and finals slots', () => {
    const definition = createDoubleElimBracket(4);
    expect(definition.slots.some((slot) => slot.bracketSide === 'winners')).toBe(true);
    expect(definition.slots.some((slot) => slot.bracketSide === 'losers')).toBe(true);
    expect(definition.slots.some((slot) => slot.slotKey === 'FIN')).toBe(true);
    expect(definition.slots.some((slot) => slot.slotKey === 'RESET')).toBe(true);
    expect(definition.hasGrandFinalsReset).toBe(true);
  });

  it('throws for unsupported player counts', () => {
    expect(() => createDoubleElimBracket(1)).toThrow();
    expect(() => createDoubleElimBracket(17)).toThrow();
  });
});

describe('createCustom10PlayerBracket', () => {
  it('matches the expected topology', () => {
    const definition = createCustom10PlayerBracket();
    const slots = slotMap(definition);

    expect(definition.slots).toHaveLength(15);
    expect(slots.get('W1')).toMatchObject({
      source1: { type: 'seed', seedNum: 3 },
      source2: { type: 'seed', seedNum: 6 },
    });
    expect(slots.get('W3')).toMatchObject({
      source1: { type: 'seed', seedNum: 1 },
      source2: { type: 'match', slotKey: 'W1', takes: 'winner' },
    });
    expect(slots.get('L3')).toMatchObject({
      source2: { type: 'match', slotKey: 'W1', takes: 'loser' },
    });
    expect(slots.get('FIN')).toMatchObject({
      source1: { type: 'match', slotKey: 'W5', takes: 'winner' },
      source2: { type: 'match', slotKey: 'L8', takes: 'winner' },
    });
  });
});

describe('getDownstreamSlots', () => {
  it('returns winner and loser downstream targets', () => {
    const definition = createCustom10PlayerBracket();
    const downstream = getDownstreamSlots(definition, 'W1');

    expect(downstream).toEqual({
      winnerGoesTo: { slotKey: 'W3', position: 2 },
      loserGoesTo: { slotKey: 'L3', position: 2 },
    });
  });
});

describe('getReadySlots', () => {
  it('returns first round slots when nothing is completed', () => {
    const definition = createSingleElimBracket(4);
    const ready = getReadySlots(definition, new Set(), new Set());

    expect(ready).toEqual(['W1', 'W2']);
  });

  it('returns downstream matches when dependencies are complete', () => {
    const definition = createSingleElimBracket(4);
    const ready = getReadySlots(definition, new Set(['W1', 'W2']), new Set(['W1', 'W2']));

    expect(ready).toEqual(['W3']);
  });
});

describe('getBracketDefinition', () => {
  it('routes to format-specific generators', () => {
    expect(getBracketDefinition('single_elimination', 8)).toMatchObject(createSingleElimBracket(8));
    expect(getBracketDefinition('custom_10_player', 10)).toMatchObject(createCustom10PlayerBracket());
  });
});

describe('isBracketFormat', () => {
  it('flags bracket formats only', () => {
    expect(isBracketFormat('single_elimination')).toBe(true);
    expect(isBracketFormat('double_elimination')).toBe(true);
    expect(isBracketFormat('custom_10_player')).toBe(true);
    expect(isBracketFormat('swiss')).toBe(false);
    expect(isBracketFormat('seeded_swiss')).toBe(false);
    expect(isBracketFormat('round_robin')).toBe(false);
  });
});

describe('isSwissFormat', () => {
  it('flags swiss formats only', () => {
    expect(isSwissFormat('swiss')).toBe(true);
    expect(isSwissFormat('seeded_swiss')).toBe(true);
    expect(isSwissFormat('round_robin')).toBe(false);
    expect(isSwissFormat('single_elimination')).toBe(false);
  });
});

describe('isPairingFormat', () => {
  it('flags pairing formats only', () => {
    expect(isPairingFormat('swiss')).toBe(true);
    expect(isPairingFormat('seeded_swiss')).toBe(true);
    expect(isPairingFormat('round_robin')).toBe(true);
    expect(isPairingFormat('single_elimination')).toBe(false);
  });
});

describe('supportsRegeneratePairings', () => {
  it('allows regenerate only for swiss formats', () => {
    expect(supportsRegeneratePairings('swiss')).toBe(true);
    expect(supportsRegeneratePairings('seeded_swiss')).toBe(true);
    expect(supportsRegeneratePairings('round_robin')).toBe(false);
    expect(supportsRegeneratePairings('single_elimination')).toBe(false);
    expect(supportsRegeneratePairings('custom_10_player')).toBe(false);
  });
});
