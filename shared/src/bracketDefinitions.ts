export type BracketSide = 'winners' | 'losers' | 'finals';

export type SlotSource =
  | { type: 'seed'; seedNum: number }
  | { type: 'match'; slotKey: string; takes: 'winner' | 'loser' };

export type BracketSlotDef = {
  slotKey: string;
  bracketSide: BracketSide;
  bracketRound: number;
  source1: SlotSource;
  source2: SlotSource;
  col: number;
  row: number;
};

export type BracketDefinition = {
  format: string;
  slots: BracketSlotDef[];
  hasGrandFinalsReset: boolean;
};

type DownstreamTarget = { slotKey: string; position: 1 | 2 };

const BRACKET_FORMATS = new Set(['single_elimination', 'double_elimination', 'custom_10_player']);

export type BracketEventFormat = 'single_elimination' | 'double_elimination' | 'custom_10_player';
export type SwissEventFormat = 'swiss' | 'seeded_swiss';
export type PairingEventFormat = SwissEventFormat | 'round_robin';

function numericKey(slotKey: string) {
  return Number.parseInt(slotKey.replace(/^[A-Z]+/, ''), 10) || 0;
}

function nextPowerOfTwo(value: number) {
  let next = 1;
  while (next < value) {
    next *= 2;
  }
  return next;
}

function standardSeedOrder(bracketSize: number) {
  let order = [1, 2];
  while (order.length < bracketSize) {
    const nextMax = order.length * 2 + 1;
    const expanded: number[] = [];
    for (const seed of order) {
      expanded.push(seed);
      expanded.push(nextMax - seed);
    }
    order = expanded;
  }
  return order;
}

function replaceMatchSource(slot: BracketSlotDef, fromSlotKey: string, replacement: SlotSource) {
  const next = { ...slot };
  if (next.source1.type === 'match' && next.source1.slotKey === fromSlotKey && next.source1.takes === 'winner') {
    next.source1 = replacement;
  }
  if (next.source2.type === 'match' && next.source2.slotKey === fromSlotKey && next.source2.takes === 'winner') {
    next.source2 = replacement;
  }
  return next;
}

function compactAndRenumberSingleElim(slots: BracketSlotDef[], playerCount: number) {
  const autoAdvanceSeeds = new Map<string, SlotSource>();
  for (const slot of slots) {
    if (slot.bracketRound !== 1) {
      continue;
    }
    const s1Valid = slot.source1.type === 'seed' && slot.source1.seedNum <= playerCount;
    const s2Valid = slot.source2.type === 'seed' && slot.source2.seedNum <= playerCount;
    if (s1Valid && !s2Valid) {
      autoAdvanceSeeds.set(slot.slotKey, slot.source1);
    } else if (!s1Valid && s2Valid) {
      autoAdvanceSeeds.set(slot.slotKey, slot.source2);
    }
  }

  let compact = slots
    .filter((slot) => !autoAdvanceSeeds.has(slot.slotKey))
    .map((slot) => {
      let current = slot;
      for (const [removedSlotKey, source] of autoAdvanceSeeds.entries()) {
        current = replaceMatchSource(current, removedSlotKey, source);
      }
      return current;
    });

  compact = compact.sort((a, b) => {
    if (a.bracketRound !== b.bracketRound) {
      return a.bracketRound - b.bracketRound;
    }
    return numericKey(a.slotKey) - numericKey(b.slotKey);
  });

  const keyMap = new Map<string, string>();
  compact.forEach((slot, index) => {
    keyMap.set(slot.slotKey, `W${index + 1}`);
  });

  return compact.map((slot) => ({
    ...slot,
    slotKey: keyMap.get(slot.slotKey) ?? slot.slotKey,
    source1:
      slot.source1.type === 'match'
        ? { ...slot.source1, slotKey: keyMap.get(slot.source1.slotKey) ?? slot.source1.slotKey }
        : slot.source1,
    source2:
      slot.source2.type === 'match'
        ? { ...slot.source2, slotKey: keyMap.get(slot.source2.slotKey) ?? slot.source2.slotKey }
        : slot.source2,
  }));
}

function validatePlayerCount(playerCount: number) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 16) {
    throw new Error('Player count must be an integer between 2 and 16.');
  }
}

export function createSingleElimBracket(playerCount: number): BracketDefinition {
  validatePlayerCount(playerCount);

  const bracketSize = nextPowerOfTwo(playerCount);
  const seedOrder = standardSeedOrder(bracketSize);
  const fullSlots: BracketSlotDef[] = [];
  let nextSlotNum = 1;

  let previousRoundSlotKeys: string[] = [];
  const firstRoundMatchCount = bracketSize / 2;
  for (let i = 0; i < firstRoundMatchCount; i += 1) {
    const slotKey = `W${nextSlotNum++}`;
    previousRoundSlotKeys.push(slotKey);
    fullSlots.push({
      slotKey,
      bracketSide: 'winners',
      bracketRound: 1,
      source1: { type: 'seed', seedNum: seedOrder[i * 2] },
      source2: { type: 'seed', seedNum: seedOrder[i * 2 + 1] },
      col: 1,
      row: i + 1,
    });
  }

  const totalRounds = Math.log2(bracketSize);
  for (let round = 2; round <= totalRounds; round += 1) {
    const roundSlotKeys: string[] = [];
    for (let i = 0; i < previousRoundSlotKeys.length; i += 2) {
      const slotKey = `W${nextSlotNum++}`;
      roundSlotKeys.push(slotKey);
      fullSlots.push({
        slotKey,
        bracketSide: 'winners',
        bracketRound: round,
        source1: { type: 'match', slotKey: previousRoundSlotKeys[i], takes: 'winner' },
        source2: { type: 'match', slotKey: previousRoundSlotKeys[i + 1], takes: 'winner' },
        col: round,
        row: Math.floor(i / 2) + 1,
      });
    }
    previousRoundSlotKeys = roundSlotKeys;
  }

  const slots = compactAndRenumberSingleElim(fullSlots, playerCount);
  return {
    format: 'single_elimination',
    hasGrandFinalsReset: false,
    slots,
  };
}

export function createDoubleElimBracket(playerCount: number): BracketDefinition {
  validatePlayerCount(playerCount);

  const winners = createSingleElimBracket(playerCount);
  const winnerSlots = [...winners.slots].sort((a, b) => {
    if (a.bracketRound !== b.bracketRound) {
      return a.bracketRound - b.bracketRound;
    }
    return numericKey(a.slotKey) - numericKey(b.slotKey);
  });
  const winnersFinal = winnerSlots[winnerSlots.length - 1];
  const nonFinalWinnerSlots = winnerSlots.slice(0, -1);

  const losers: BracketSlotDef[] = [];
  if (nonFinalWinnerSlots.length > 0) {
    let loserIndex = 1;
    const firstA = nonFinalWinnerSlots[0];
    const firstB = nonFinalWinnerSlots[Math.min(1, nonFinalWinnerSlots.length - 1)];
    losers.push({
      slotKey: `L${loserIndex}`,
      bracketSide: 'losers',
      bracketRound: 1,
      source1: { type: 'match', slotKey: firstA.slotKey, takes: 'loser' },
      source2: { type: 'match', slotKey: firstB.slotKey, takes: 'loser' },
      col: 1,
      row: 1,
    });

    for (let i = 2; i < nonFinalWinnerSlots.length; i += 1) {
      loserIndex += 1;
      losers.push({
        slotKey: `L${loserIndex}`,
        bracketSide: 'losers',
        bracketRound: loserIndex,
        source1: { type: 'match', slotKey: `L${loserIndex - 1}`, takes: 'winner' },
        source2: { type: 'match', slotKey: nonFinalWinnerSlots[i].slotKey, takes: 'loser' },
        col: loserIndex,
        row: 1,
      });
    }
  }

  const lastLosersSlotKey = losers.length > 0 ? losers[losers.length - 1].slotKey : nonFinalWinnerSlots[0]?.slotKey;
  const finals: BracketSlotDef[] = [
    {
      slotKey: 'FIN',
      bracketSide: 'finals',
      bracketRound: 1,
      source1: { type: 'match', slotKey: winnersFinal.slotKey, takes: 'winner' },
      source2: { type: 'match', slotKey: lastLosersSlotKey ?? winnersFinal.slotKey, takes: 'winner' },
      col: 1,
      row: 1,
    },
    {
      slotKey: 'RESET',
      bracketSide: 'finals',
      bracketRound: 2,
      source1: { type: 'match', slotKey: 'FIN', takes: 'winner' },
      source2: { type: 'match', slotKey: 'FIN', takes: 'loser' },
      col: 2,
      row: 1,
    },
  ];

  return {
    format: 'double_elimination',
    hasGrandFinalsReset: true,
    slots: [...winnerSlots, ...losers, ...finals],
  };
}

export function createCustom10PlayerBracket(): BracketDefinition {
  const slots: BracketSlotDef[] = [
    {
      slotKey: 'W1',
      bracketSide: 'winners',
      bracketRound: 1,
      source1: { type: 'seed', seedNum: 3 },
      source2: { type: 'seed', seedNum: 6 },
      col: 1,
      row: 2,
    },
    {
      slotKey: 'W2',
      bracketSide: 'winners',
      bracketRound: 1,
      source1: { type: 'seed', seedNum: 4 },
      source2: { type: 'seed', seedNum: 5 },
      col: 1,
      row: 1,
    },
    {
      slotKey: 'W3',
      bracketSide: 'winners',
      bracketRound: 2,
      source1: { type: 'seed', seedNum: 1 },
      source2: { type: 'match', slotKey: 'W1', takes: 'winner' },
      col: 2,
      row: 2,
    },
    {
      slotKey: 'W4',
      bracketSide: 'winners',
      bracketRound: 2,
      source1: { type: 'seed', seedNum: 2 },
      source2: { type: 'match', slotKey: 'W2', takes: 'winner' },
      col: 2,
      row: 1,
    },
    {
      slotKey: 'W5',
      bracketSide: 'winners',
      bracketRound: 3,
      source1: { type: 'match', slotKey: 'W3', takes: 'winner' },
      source2: { type: 'match', slotKey: 'W4', takes: 'winner' },
      col: 3,
      row: 1,
    },
    {
      slotKey: 'L1',
      bracketSide: 'losers',
      bracketRound: 1,
      source1: { type: 'seed', seedNum: 9 },
      source2: { type: 'seed', seedNum: 10 },
      col: 1,
      row: 2,
    },
    {
      slotKey: 'L2',
      bracketSide: 'losers',
      bracketRound: 1,
      source1: { type: 'seed', seedNum: 7 },
      source2: { type: 'seed', seedNum: 8 },
      col: 1,
      row: 1,
    },
    {
      slotKey: 'L3',
      bracketSide: 'losers',
      bracketRound: 2,
      source1: { type: 'match', slotKey: 'L1', takes: 'winner' },
      source2: { type: 'match', slotKey: 'W1', takes: 'loser' },
      col: 2,
      row: 2,
    },
    {
      slotKey: 'L4',
      bracketSide: 'losers',
      bracketRound: 2,
      source1: { type: 'match', slotKey: 'L2', takes: 'winner' },
      source2: { type: 'match', slotKey: 'W2', takes: 'loser' },
      col: 2,
      row: 1,
    },
    {
      slotKey: 'L5',
      bracketSide: 'losers',
      bracketRound: 3,
      source1: { type: 'match', slotKey: 'L3', takes: 'winner' },
      source2: { type: 'match', slotKey: 'W3', takes: 'loser' },
      col: 3,
      row: 2,
    },
    {
      slotKey: 'L6',
      bracketSide: 'losers',
      bracketRound: 3,
      source1: { type: 'match', slotKey: 'L4', takes: 'winner' },
      source2: { type: 'match', slotKey: 'W4', takes: 'loser' },
      col: 3,
      row: 1,
    },
    {
      slotKey: 'L7',
      bracketSide: 'losers',
      bracketRound: 4,
      source1: { type: 'match', slotKey: 'L5', takes: 'winner' },
      source2: { type: 'match', slotKey: 'W5', takes: 'loser' },
      col: 4,
      row: 2,
    },
    {
      slotKey: 'L8',
      bracketSide: 'losers',
      bracketRound: 5,
      source1: { type: 'match', slotKey: 'L6', takes: 'winner' },
      source2: { type: 'match', slotKey: 'L7', takes: 'winner' },
      col: 5,
      row: 1,
    },
    {
      slotKey: 'FIN',
      bracketSide: 'finals',
      bracketRound: 1,
      source1: { type: 'match', slotKey: 'W5', takes: 'winner' },
      source2: { type: 'match', slotKey: 'L8', takes: 'winner' },
      col: 1,
      row: 1,
    },
    {
      slotKey: 'RESET',
      bracketSide: 'finals',
      bracketRound: 2,
      source1: { type: 'match', slotKey: 'FIN', takes: 'winner' },
      source2: { type: 'match', slotKey: 'FIN', takes: 'loser' },
      col: 2,
      row: 1,
    },
  ];

  return {
    format: 'custom_10_player',
    hasGrandFinalsReset: true,
    slots,
  };
}

export function isBracketFormat(format: string): format is BracketEventFormat {
  return BRACKET_FORMATS.has(format);
}

export function isSwissFormat(format: string): format is SwissEventFormat {
  return format === 'swiss' || format === 'seeded_swiss';
}

export function isPairingFormat(format: string): format is PairingEventFormat {
  return isSwissFormat(format) || format === 'round_robin';
}

export function supportsRegeneratePairings(format: string): boolean {
  return isSwissFormat(format);
}

export function getBracketDefinition(format: string, playerCount: number): BracketDefinition {
  if (format === 'single_elimination') {
    return createSingleElimBracket(playerCount);
  }
  if (format === 'double_elimination') {
    return createDoubleElimBracket(playerCount);
  }
  if (format === 'custom_10_player') {
    return createCustom10PlayerBracket();
  }
  throw new Error(`Unsupported bracket format: ${format}`);
}

export function getDownstreamSlots(definition: BracketDefinition, slotKey: string) {
  const downstream: { winnerGoesTo?: DownstreamTarget; loserGoesTo?: DownstreamTarget } = {};

  for (const slot of definition.slots) {
    if (slot.source1.type === 'match' && slot.source1.slotKey === slotKey) {
      if (slot.source1.takes === 'winner') {
        downstream.winnerGoesTo = { slotKey: slot.slotKey, position: 1 };
      } else {
        downstream.loserGoesTo = { slotKey: slot.slotKey, position: 1 };
      }
    }

    if (slot.source2.type === 'match' && slot.source2.slotKey === slotKey) {
      if (slot.source2.takes === 'winner') {
        downstream.winnerGoesTo = { slotKey: slot.slotKey, position: 2 };
      } else {
        downstream.loserGoesTo = { slotKey: slot.slotKey, position: 2 };
      }
    }
  }

  return downstream;
}

export function getReadySlots(definition: BracketDefinition, completedSlotKeys: Set<string>, matchedSlotKeys: Set<string>) {
  return definition.slots
    .filter((slot) => !completedSlotKeys.has(slot.slotKey) && !matchedSlotKeys.has(slot.slotKey))
    .filter((slot) => {
      const sourceReady = (source: SlotSource) => {
        if (source.type === 'seed') {
          return true;
        }
        return completedSlotKeys.has(source.slotKey);
      };
      return sourceReady(slot.source1) && sourceReady(slot.source2);
    })
    .sort((a, b) => {
      if (a.bracketRound !== b.bracketRound) {
        return a.bracketRound - b.bracketRound;
      }
      return numericKey(a.slotKey) - numericKey(b.slotKey);
    })
    .map((slot) => slot.slotKey);
}
