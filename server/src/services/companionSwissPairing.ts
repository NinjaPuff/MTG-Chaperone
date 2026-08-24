export type CompanionPair = { player1Id: string; player2Id: string | null; isBye: boolean };

export type CompanionEventRecord = {
  userId: string;
  points: number;
  omwPercent: number;
  gwPercent: number;
  ogwPercent: number;
};

export type PairCompanionSwissArgs = {
  playerIds: string[];
  eventRecords: CompanionEventRecord[];
  playedPairs: Set<string>;
  priorByeIds: Set<string>;
  roundNumber: number;
  totalRounds: number | null;
  random: () => number;
};

const DEFAULT_RECORD = { points: 0, omwPercent: 0.33, gwPercent: 0.33, ogwPercent: 0.33 };

export function isFinalRound(roundNumber: number, totalRounds: number | null): boolean {
  return totalRounds != null && roundNumber === totalRounds && roundNumber > 1;
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildPairKey(playerA: string, playerB: string) {
  return playerA < playerB ? `${playerA}:${playerB}` : `${playerB}:${playerA}`;
}

function recordMap(eventRecords: CompanionEventRecord[]) {
  return new Map(eventRecords.map((record) => [record.userId, record]));
}

function getRecord(records: Map<string, CompanionEventRecord>, userId: string): CompanionEventRecord {
  return records.get(userId) ?? { userId, ...DEFAULT_RECORD };
}

function eligibleIds(playerIds: string[], priorByeIds: Set<string>) {
  const eligible = playerIds.filter((id) => !priorByeIds.has(id));
  return eligible.length > 0 ? eligible : [...playerIds];
}

export function selectByePlayer(args: {
  playerIds: string[];
  eventRecords: CompanionEventRecord[];
  priorByeIds: Set<string>;
  roundNumber: number;
  totalRounds: number | null;
  random: () => number;
}): string {
  const { playerIds, eventRecords, priorByeIds, roundNumber, totalRounds, random } = args;
  const records = recordMap(eventRecords);
  const eligible = eligibleIds(playerIds, priorByeIds);
  const eligibleSet = new Set(eligible);

  if (roundNumber === 1) {
    const shuffled = shuffle(playerIds, random);
    for (let index = shuffled.length - 1; index >= 0; index -= 1) {
      if (eligibleSet.has(shuffled[index])) {
        return shuffled[index];
      }
    }
    return shuffled[shuffled.length - 1];
  }

  if (isFinalRound(roundNumber, totalRounds)) {
    const order = new Map(playerIds.map((id, index) => [id, index]));
    const rankedWorstFirst = [...eligible].sort((a, b) => {
      const ra = getRecord(records, a);
      const rb = getRecord(records, b);
      if (ra.points !== rb.points) {
        return ra.points - rb.points;
      }
      if (ra.omwPercent !== rb.omwPercent) {
        return ra.omwPercent - rb.omwPercent;
      }
      if (ra.gwPercent !== rb.gwPercent) {
        return ra.gwPercent - rb.gwPercent;
      }
      if (ra.ogwPercent !== rb.ogwPercent) {
        return ra.ogwPercent - rb.ogwPercent;
      }
      return (order.get(b) ?? 0) - (order.get(a) ?? 0);
    });
    return rankedWorstFirst[0];
  }

  const minPoints = Math.min(...eligible.map((id) => getRecord(records, id).points));
  const tied = eligible.filter((id) => getRecord(records, id).points === minPoints);
  const shuffledTied = shuffle(tied, random);
  return shuffledTied[shuffledTied.length - 1];
}

function pairAdjacent(playerIds: string[]): CompanionPair[] {
  const pairs: CompanionPair[] = [];
  for (let index = 0; index + 1 < playerIds.length; index += 2) {
    pairs.push({ player1Id: playerIds[index], player2Id: playerIds[index + 1], isBye: false });
  }
  return pairs;
}

function findMatching(
  pool: string[],
  playedPairs: Set<string>,
  allowRematch: boolean,
): CompanionPair[] | null {
  if (pool.length === 0) {
    return [];
  }
  if (pool.length % 2 === 1) {
    return null;
  }

  const player1 = pool[0];
  for (let index = 1; index < pool.length; index += 1) {
    const player2 = pool[index];
    const isRematch = playedPairs.has(buildPairKey(player1, player2));
    if (isRematch && !allowRematch) {
      continue;
    }
    const rest = pool.filter((_, restIndex) => restIndex !== 0 && restIndex !== index);
    const restMatch = findMatching(rest, playedPairs, allowRematch);
    if (restMatch) {
      return [{ player1Id: player1, player2Id: player2, isBye: false }, ...restMatch];
    }
  }

  return null;
}

function chooseDownfloater(pool: string[], nextGroup: string[], playedPairs: Set<string>) {
  // MTR 10.4 does not name the floater. EventLink/Companion pick at random inside
  // the score group and repair rematches. Walking the shuffled pool and keeping
  // the first player who leaves a legal matching is that rule, not fold pairing.
  for (const candidate of pool) {
    const hasLegalInNext = nextGroup.some((opponent) => !playedPairs.has(buildPairKey(candidate, opponent)));
    const rest = pool.filter((id) => id !== candidate);
    const restMatching = rest.length % 2 === 0 ? findMatching(rest, playedPairs, false) : null;
    if (hasLegalInNext || restMatching) {
      return candidate;
    }
  }
  return pool[pool.length - 1];
}

function rankPlayersForFinal(
  playerIds: string[],
  remaining: string[],
  records: Map<string, CompanionEventRecord>,
) {
  const order = new Map(playerIds.map((id, index) => [id, index]));
  return [...remaining].sort((a, b) => {
    const ra = getRecord(records, a);
    const rb = getRecord(records, b);
    if (rb.points !== ra.points) {
      return rb.points - ra.points;
    }
    if (rb.omwPercent !== ra.omwPercent) {
      return rb.omwPercent - ra.omwPercent;
    }
    if (rb.gwPercent !== ra.gwPercent) {
      return rb.gwPercent - ra.gwPercent;
    }
    if (rb.ogwPercent !== ra.ogwPercent) {
      return rb.ogwPercent - ra.ogwPercent;
    }
    return (order.get(a) ?? 0) - (order.get(b) ?? 0);
  });
}

function pairByStandings(ranked: string[], playedPairs: Set<string>): CompanionPair[] {
  const remaining = [...ranked];
  const pairs: CompanionPair[] = [];
  while (remaining.length >= 2) {
    const player1 = remaining.shift()!;
    let opponentIndex = remaining.findIndex((player2) => !playedPairs.has(buildPairKey(player1, player2)));
    if (opponentIndex === -1) {
      opponentIndex = 0;
    }
    const player2 = remaining.splice(opponentIndex, 1)[0];
    pairs.push({ player1Id: player1, player2Id: player2, isBye: false });
  }
  return pairs;
}

function pairScoreGroups(
  playerIds: string[],
  records: Map<string, CompanionEventRecord>,
  playedPairs: Set<string>,
  random: () => number,
): CompanionPair[] {
  const groups = new Map<number, string[]>();
  for (const playerId of playerIds) {
    const points = getRecord(records, playerId).points;
    const bucket = groups.get(points) ?? [];
    bucket.push(playerId);
    groups.set(points, bucket);
  }

  const pointLevels = Array.from(groups.keys()).sort((a, b) => b - a);
  const pairs: CompanionPair[] = [];
  let carryDown: string[] = [];

  for (let groupIndex = 0; groupIndex < pointLevels.length; groupIndex += 1) {
    const isLast = groupIndex === pointLevels.length - 1;
    const nextGroup = isLast ? [] : (groups.get(pointLevels[groupIndex + 1]) ?? []);
    let pool = shuffle([...carryDown, ...(groups.get(pointLevels[groupIndex]) ?? [])], random);
    carryDown = [];

    if (pool.length % 2 === 1 && !isLast) {
      const downfloater = chooseDownfloater(pool, nextGroup, playedPairs);
      pool = pool.filter((id) => id !== downfloater);
      carryDown.push(downfloater);
    }

    const matching = findMatching(pool, playedPairs, false);
    if (matching) {
      pairs.push(...matching);
      continue;
    }

    if (!isLast && pool.length > 0) {
      carryDown.push(pool[0]);
      const rest = pool.slice(1);
      if (rest.length >= 2 && rest.length % 2 === 0) {
        const retry = findMatching(rest, playedPairs, false);
        if (retry) {
          pairs.push(...retry);
        } else {
          carryDown.push(...rest);
        }
      } else {
        carryDown.push(...rest);
      }
      continue;
    }

    const forced = findMatching(pool, playedPairs, true);
    if (forced) {
      pairs.push(...forced);
    }
  }

  if (carryDown.length >= 2) {
    const leftover = findMatching(carryDown, playedPairs, true);
    if (leftover) {
      pairs.push(...leftover);
    }
  }

  return pairs;
}

function pairRoundOne(
  playerIds: string[],
  priorByeIds: Set<string>,
  random: () => number,
): CompanionPair[] {
  const shuffled = shuffle(playerIds, random);
  const pairs: CompanionPair[] = [];
  let remaining = shuffled;

  if (remaining.length % 2 === 1) {
    const eligible = new Set(eligibleIds(playerIds, priorByeIds));
    let byeIndex = remaining.length - 1;
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (eligible.has(remaining[index])) {
        byeIndex = index;
        break;
      }
    }
    const byeId = remaining[byeIndex];
    remaining = remaining.filter((_, index) => index !== byeIndex);
    pairs.push(...pairAdjacent(remaining));
    pairs.push({ player1Id: byeId, player2Id: null, isBye: true });
    return pairs;
  }

  return pairAdjacent(remaining);
}

export function pairCompanionSwiss(args: PairCompanionSwissArgs): CompanionPair[] {
  const { playerIds, eventRecords, playedPairs, priorByeIds, roundNumber, totalRounds, random } = args;
  if (playerIds.length === 0) {
    return [];
  }

  if (roundNumber === 1) {
    return pairRoundOne(playerIds, priorByeIds, random);
  }

  const records = recordMap(eventRecords);
  const pairs: CompanionPair[] = [];
  let remaining = [...playerIds];

  if (remaining.length % 2 === 1) {
    const byeId = selectByePlayer({
      playerIds: remaining,
      eventRecords,
      priorByeIds,
      roundNumber,
      totalRounds,
      random,
    });
    remaining = remaining.filter((id) => id !== byeId);
    pairs.push({ player1Id: byeId, player2Id: null, isBye: true });
  }

  if (remaining.length === 0) {
    return pairs;
  }

  if (isFinalRound(roundNumber, totalRounds)) {
    const ranked = rankPlayersForFinal(playerIds, remaining, records);
    return [...pairByStandings(ranked, playedPairs), ...pairs];
  }

  return [...pairScoreGroups(remaining, records, playedPairs, random), ...pairs];
}
