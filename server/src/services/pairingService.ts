import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type Pair = { player1Id: string; player2Id: string | null; isBye: boolean };
type PlayerRankStat = { userId: string; matchWins: number; gameWins: number; gameLosses: number };
type RankedPlayer = { userId: string; points: number };

export function pairSequential(playerIds: string[]): Pair[] {
  const pairs: Pair[] = [];
  const queue = [...playerIds];
  while (queue.length >= 2) {
    const player1Id = queue.shift()!;
    const player2Id = queue.shift()!;
    pairs.push({ player1Id, player2Id, isBye: false });
  }
  if (queue.length === 1) {
    pairs.push({ player1Id: queue[0], player2Id: null, isBye: true });
  }
  return pairs;
}

export function pairTopVsBottom(playerIds: string[]): Pair[] {
  const pairs: Pair[] = [];
  let left = 0;
  let right = playerIds.length - 1;

  while (left < right) {
    pairs.push({
      player1Id: playerIds[left],
      player2Id: playerIds[right],
      isBye: false,
    });
    left += 1;
    right -= 1;
  }

  if (left === right) {
    pairs.push({
      player1Id: playerIds[left],
      player2Id: null,
      isBye: true,
    });
  }

  return pairs;
}

function buildPairKey(playerA: string, playerB: string) {
  return playerA < playerB ? `${playerA}:${playerB}` : `${playerB}:${playerA}`;
}

function pairFromPool(
  pool: RankedPlayer[],
  playedPairs: Set<string>,
  allowRematches: boolean,
) {
  if (pool.length < 2) {
    return null;
  }

  const player1 = pool[0];
  let candidateIndex = -1;
  for (let index = 1; index < pool.length; index += 1) {
    if (!playedPairs.has(buildPairKey(player1.userId, pool[index].userId))) {
      candidateIndex = index;
      break;
    }
  }

  if (candidateIndex === -1) {
    if (!allowRematches) {
      return null;
    }
    candidateIndex = 1;
  }

  const player2 = pool[candidateIndex];
  pool.splice(candidateIndex, 1);
  pool.splice(0, 1);

  return {
    player1Id: player1.userId,
    player2Id: player2.userId,
    isBye: false as const,
  };
}

export function pairSwissScoreGroups(
  players: RankedPlayer[],
  playedPairs: Set<string>,
  priorByeIds: Set<string>,
): Pair[] {
  if (players.length === 0) {
    return [];
  }

  const pairs: Pair[] = [];
  const ordered = [...players];
  let byePair: Pair | null = null;

  if (ordered.length % 2 === 1) {
    let byeIndex = ordered.length - 1;
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      if (!priorByeIds.has(ordered[index].userId)) {
        byeIndex = index;
        break;
      }
    }
    const [byePlayer] = ordered.splice(byeIndex, 1);
    byePair = { player1Id: byePlayer.userId, player2Id: null, isBye: true };
  }

  const groupsByPoints = new Map<number, RankedPlayer[]>();
  for (const player of ordered) {
    const bucket = groupsByPoints.get(player.points) ?? [];
    bucket.push(player);
    groupsByPoints.set(player.points, bucket);
  }

  const pointGroups = Array.from(groupsByPoints.values()).map((group) => [...group]);
  let carryDown: RankedPlayer[] = [];

  for (let groupIndex = 0; groupIndex < pointGroups.length; groupIndex += 1) {
    const group = [...carryDown, ...pointGroups[groupIndex]];
    carryDown = [];

    while (group.length > 1) {
      const pair = pairFromPool(group, playedPairs, false);
      if (pair) {
        pairs.push(pair);
        continue;
      }

      if (groupIndex < pointGroups.length - 1) {
        carryDown.push(group.shift()!);
        continue;
      }

      const rematchPair = pairFromPool(group, playedPairs, true);
      if (!rematchPair) {
        break;
      }
      pairs.push(rematchPair);
    }

    if (group.length === 1) {
      carryDown.push(group.shift()!);
    }
  }

  while (carryDown.length > 1) {
    const pair = pairFromPool(carryDown, playedPairs, true);
    if (!pair) {
      break;
    }
    pairs.push(pair);
  }

  if (byePair) {
    pairs.push(byePair);
  }

  return pairs;
}

async function getSeasonPlayerIdsForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      season: {
        include: {
          league: {
            include: {
              memberships: {
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  const ids = event.season.league.memberships.map((membership) => membership.userId);
  return { event, playerIds: ids };
}

async function filterDroppedPlayers(seasonId: string, eventId: string, userIds: string[]) {
  if (userIds.length === 0) {
    return userIds;
  }

  const drops = await prisma.playerDrop.findMany({
    where: {
      seasonId,
      userId: { in: userIds },
      OR: [{ eventId }, { eventId: null }],
    },
    select: { userId: true },
  });

  const droppedIds = new Set(drops.map((drop) => drop.userId));
  return userIds.filter((userId) => !droppedIds.has(userId));
}

function mergeRankedWithFallback(rankedPlayerIds: string[], fallbackPlayerIds: string[]) {
  const rankedSet = new Set(rankedPlayerIds);
  const merged = [...rankedPlayerIds];
  for (const playerId of fallbackPlayerIds) {
    if (!rankedSet.has(playerId)) {
      merged.push(playerId);
    }
  }
  return merged;
}

export function rankPlayersByMatchResults(
  playerIds: string[],
  matches: Array<{
    isBye: boolean;
    player1Id: string;
    player2Id: string | null;
    gameResults: Array<{ winnerId: string | null; isDraw: boolean }>;
  }>,
) {
  const fallbackOrder = new Map<string, number>();
  const stats = new Map<string, PlayerRankStat>();

  playerIds.forEach((playerId, index) => {
    fallbackOrder.set(playerId, index);
    stats.set(playerId, { userId: playerId, matchWins: 0, gameWins: 0, gameLosses: 0 });
  });

  for (const match of matches) {
    const p1 = stats.get(match.player1Id);
    const p2 = match.player2Id ? stats.get(match.player2Id) : undefined;
    if (!p1) {
      continue;
    }

    let p1GamesWon = 0;
    let p2GamesWon = 0;
    for (const game of match.gameResults) {
      if (game.isDraw || !game.winnerId) {
        continue;
      }
      if (game.winnerId === match.player1Id) {
        p1GamesWon += 1;
      } else if (match.player2Id && game.winnerId === match.player2Id) {
        p2GamesWon += 1;
      }
    }

    p1.gameWins += p1GamesWon;
    p1.gameLosses += p2GamesWon;
    if (p2) {
      p2.gameWins += p2GamesWon;
      p2.gameLosses += p1GamesWon;
    }

    if (match.isBye || !p2) {
      p1.matchWins += 1;
      continue;
    }

    if (p1GamesWon > p2GamesWon) {
      p1.matchWins += 1;
    } else if (p2GamesWon > p1GamesWon) {
      p2.matchWins += 1;
    }
  }

  return Array.from(stats.values())
    .sort((a, b) => {
      if (b.matchWins !== a.matchWins) {
        return b.matchWins - a.matchWins;
      }

      const aGameTotal = a.gameWins + a.gameLosses;
      const bGameTotal = b.gameWins + b.gameLosses;
      const aGwPercent = aGameTotal === 0 ? 0 : a.gameWins / aGameTotal;
      const bGwPercent = bGameTotal === 0 ? 0 : b.gameWins / bGameTotal;
      if (bGwPercent !== aGwPercent) {
        return bGwPercent - aGwPercent;
      }

      return (fallbackOrder.get(a.userId) ?? 0) - (fallbackOrder.get(b.userId) ?? 0);
    })
    .map((entry) => entry.userId);
}

export async function resolveSeededPlayerOrder(
  eventId: string,
  options: { strict?: boolean } = {},
) {
  const { playerIds: fallbackPlayerIds } = await getSeasonPlayerIdsForEvent(eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      config: { select: { seedingSource: true } },
      season: { select: { id: true, number: true, leagueId: true } },
    },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  const source = event.config?.seedingSource ?? null;
  if (!source) {
    if (options.strict) {
      throw new AppError(409, 'SEEDING_SOURCE_REQUIRED', 'A seeding source must be configured before start');
    }
    return fallbackPlayerIds;
  }

  if (source === 'manual') {
    const seeds = await prisma.eventSeed.findMany({
      where: { eventId: event.id },
      select: { userId: true },
      orderBy: { seedNum: 'asc' },
    });
    if (seeds.length === 0) {
      throw new AppError(409, 'SEEDS_NOT_SET', 'Manual seeds must be set before creating rounds');
    }

    const fallbackSet = new Set(fallbackPlayerIds);
    const ordered = seeds.map((seed) => seed.userId).filter((userId) => fallbackSet.has(userId));
    if (ordered.length !== fallbackPlayerIds.length) {
      throw new AppError(409, 'SEEDS_INCOMPLETE', 'Manual seeds must include all league members');
    }
    return ordered;
  }

  if (source === 'previous_event') {
    const previousEvent = await prisma.event.findFirst({
      where: {
        seasonId: event.seasonId,
        status: 'completed',
        id: { not: event.id },
      },
      select: { id: true },
      orderBy: { orderIndex: 'desc' },
    });

    if (!previousEvent) {
      if (options.strict) {
        throw new AppError(
          409,
          'SEEDING_SOURCE_UNAVAILABLE',
          'No completed previous event found in this season for seeding',
        );
      }
      return fallbackPlayerIds;
    }

    const matches = await prisma.match.findMany({
      where: {
        round: { eventId: previousEvent.id },
        status: { in: ['confirmed', 'resolved'] },
      },
      select: {
        isBye: true,
        player1Id: true,
        player2Id: true,
        gameResults: { select: { winnerId: true, isDraw: true } },
      },
    });
    const ranked = rankPlayersByMatchResults(fallbackPlayerIds, matches);
    return mergeRankedWithFallback(ranked, fallbackPlayerIds);
  }

  if (source === 'current_season') {
    const currentStandings = await prisma.standing.findMany({
      where: { seasonId: event.season.id },
      orderBy: [{ points: 'desc' }, { omwPercent: 'desc' }, { gwPercent: 'desc' }, { ogwPercent: 'desc' }],
      select: { userId: true },
    });
    if (currentStandings.length === 0) {
      if (options.strict) {
        throw new AppError(
          409,
          'SEEDING_SOURCE_UNAVAILABLE',
          'No current season standings found for seeding',
        );
      }
      return fallbackPlayerIds;
    }

    const ranked = currentStandings
      .map((standing) => standing.userId)
      .filter((userId) => fallbackPlayerIds.includes(userId));
    return mergeRankedWithFallback(ranked, fallbackPlayerIds);
  }

  if (source === 'previous_season') {
    const previousSeason = await prisma.season.findFirst({
      where: {
        leagueId: event.season.leagueId,
        isActive: false,
        id: { not: event.season.id },
      },
      select: { id: true },
      orderBy: { number: 'desc' },
    });
    if (!previousSeason) {
      if (options.strict) {
        throw new AppError(
          409,
          'SEEDING_SOURCE_UNAVAILABLE',
          'No previous inactive season found for seeding',
        );
      }
      return fallbackPlayerIds;
    }

    const previousStandings = await prisma.standing.findMany({
      where: { seasonId: previousSeason.id },
      orderBy: [{ points: 'desc' }, { omwPercent: 'desc' }, { gwPercent: 'desc' }, { ogwPercent: 'desc' }],
      select: { userId: true },
    });
    const ranked = previousStandings
      .map((standing) => standing.userId)
      .filter((userId) => fallbackPlayerIds.includes(userId));
    return mergeRankedWithFallback(ranked, fallbackPlayerIds);
  }

  return fallbackPlayerIds;
}

async function getRoundOneSeededOrder(eventId: string, fallbackPlayerIds: string[]) {
  void fallbackPlayerIds;
  return resolveSeededPlayerOrder(eventId);
}

export async function generateSwissPairings(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      event: {
        include: {
          season: true,
        },
      },
    },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }

  const standings = await prisma.standing.findMany({
    where: { seasonId: round.event.seasonId },
    orderBy: [{ points: 'desc' }, { omwPercent: 'desc' }, { gwPercent: 'desc' }],
  });

  let orderedPlayers = standings.map((standing) => standing.userId);
  if (orderedPlayers.length === 0) {
    const { playerIds } = await getSeasonPlayerIdsForEvent(round.eventId);
    orderedPlayers = await filterDroppedPlayers(round.event.seasonId, round.eventId, playerIds);
    return pairSequential(orderedPlayers);
  }

  orderedPlayers = await filterDroppedPlayers(round.event.seasonId, round.eventId, orderedPlayers);
  if (orderedPlayers.length === 0) {
    return [];
  }

  const eventMatches = await prisma.match.findMany({
    where: {
      round: { eventId: round.eventId },
      status: { in: ['confirmed', 'resolved'] },
    },
    select: {
      isBye: true,
      player1Id: true,
      player2Id: true,
    },
  });

  const playedPairs = new Set<string>();
  const priorByeIds = new Set<string>();
  for (const match of eventMatches ?? []) {
    if (match.isBye || !match.player2Id) {
      priorByeIds.add(match.player1Id);
      continue;
    }
    playedPairs.add(buildPairKey(match.player1Id, match.player2Id));
  }

  const pointByUserId = new Map(standings.map((standing) => [standing.userId, standing.points]));
  const rankedPlayers = orderedPlayers.map((userId) => ({
    userId,
    points: pointByUserId.get(userId) ?? 0,
  }));

  return pairSwissScoreGroups(
    rankedPlayers,
    playedPairs,
    priorByeIds,
  );
}

export async function generateSeededSwissPairings(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { roundNumber: true, eventId: true },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }

  if (round.roundNumber === 1) {
    const { event, playerIds } = await getSeasonPlayerIdsForEvent(round.eventId);
    const orderedPlayerIds = await getRoundOneSeededOrder(round.eventId, playerIds);
    const activePlayerIds = await filterDroppedPlayers(event.seasonId, round.eventId, orderedPlayerIds);
    return pairTopVsBottom(activePlayerIds);
  }

  return generateSwissPairings(roundId);
}

export async function generateRoundRobinSchedule(seasonId: string, playerIds: string[]) {
  await prisma.roundRobinSchedule.deleteMany({ where: { seasonId } });
  const schedule = await prisma.roundRobinSchedule.create({
    data: { seasonId },
  });

  const ids = [...playerIds];
  if (ids.length % 2 === 1) {
    ids.push('BYE');
  }

  const rounds = ids.length - 1;
  const half = ids.length / 2;
  const rotation = [...ids];
  const pairings: Array<{ player1Id: string; player2Id: string }> = [];

  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const p1 = rotation[i];
      const p2 = rotation[rotation.length - 1 - i];
      if (p1 !== 'BYE' && p2 !== 'BYE') {
        pairings.push({ player1Id: p1, player2Id: p2 });
      }
    }
    rotation.splice(1, 0, rotation.pop()!);
  }

  await prisma.scheduledPairing.createMany({
    data: pairings.map((pair) => ({
      scheduleId: schedule.id,
      player1Id: pair.player1Id,
      player2Id: pair.player2Id,
    })),
  });

  return schedule;
}

export async function assignRoundRobinPairings(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { event: { include: { season: true } } },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }

  const schedule = await prisma.roundRobinSchedule.findUnique({
    where: { seasonId: round.event.seasonId },
    include: { pairings: true },
  });
  if (!schedule || schedule.pairings.length === 0) {
    const { playerIds } = await getSeasonPlayerIdsForEvent(round.eventId);
    await generateRoundRobinSchedule(round.event.seasonId, playerIds);
  }

  const pairings = await prisma.scheduledPairing.findMany({
    where: { schedule: { seasonId: round.event.seasonId }, roundId: null },
    take: Math.ceil((await getSeasonPlayerIdsForEvent(round.eventId)).playerIds.length / 2),
  });

  const matches = await Promise.all(
    pairings.map((pairing) =>
      prisma.match.create({
        data: {
          roundId,
          player1Id: pairing.player1Id,
          player2Id: pairing.player2Id,
          isBye: false,
        },
      }),
    ),
  );

  await Promise.all(
    pairings.map((pairing) =>
      prisma.scheduledPairing.update({
        where: { id: pairing.id },
        data: { roundId },
      }),
    ),
  );

  return matches;
}

export async function regeneratePairings(roundId: string) {
  await prisma.gameResult.deleteMany({ where: { match: { roundId } } });
  await prisma.match.deleteMany({ where: { roundId } });
}

export function createPairingService() {
  return {
    pairSequential,
    pairTopVsBottom,
    generateSwissPairings,
    generateSeededSwissPairings,
    generateRoundRobinSchedule,
    assignRoundRobinPairings,
    regeneratePairings,
  };
}
