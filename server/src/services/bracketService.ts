import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { getBracketDefinition, getDownstreamSlots, isBracketFormat, type SlotSource } from '@mtg-league/shared';
import { resolveSeededPlayerOrder } from './pairingService.js';

type ScoreWinner = { winnerId: string; loserId: string };

type BracketSlotWithMatch = {
  slotKey: string;
  bracketSide: string;
  bracketRound: number;
  player1Id: string | null;
  player2Id: string | null;
  matchId: string | null;
  winnerId: string | null;
  loserId: string | null;
  match: {
    status: string;
    player1Id: string;
    player2Id: string | null;
    gameResults: Array<{ winnerId: string | null; isDraw: boolean }>;
  } | null;
};

const DECIDED_MATCH_STATUSES = new Set(['reported', 'confirmed', 'resolved']);

function computeMatchWinner(match: {
  player1Id: string;
  player2Id: string | null;
  gameResults: Array<{ winnerId: string | null; isDraw: boolean }>;
}): ScoreWinner {
  if (!match.player2Id) {
    return { winnerId: match.player1Id, loserId: match.player1Id };
  }

  let player1Wins = 0;
  let player2Wins = 0;
  for (const game of match.gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === match.player1Id) {
      player1Wins += 1;
    } else if (game.winnerId === match.player2Id) {
      player2Wins += 1;
    }
  }

  if (player1Wins === player2Wins) {
    throw new AppError(409, 'MATCH_NO_WINNER', 'Bracket matches must have a winner');
  }

  return player1Wins > player2Wins
    ? { winnerId: match.player1Id, loserId: match.player2Id }
    : { winnerId: match.player2Id, loserId: match.player1Id };
}

function slotRoundNumber(slot: { bracketSide: string; bracketRound: number }) {
  if (slot.bracketSide === 'winners') {
    return slot.bracketRound;
  }
  if (slot.bracketSide === 'losers') {
    return slot.bracketRound + 20;
  }
  return slot.bracketRound + 40;
}

export function resolveBracketParticipantUserId(
  source: SlotSource,
  slotsByKey: Map<string, BracketSlotWithMatch>,
  seedByNum: Map<number, string>,
): string | null {
  if (source.type === 'seed') {
    return seedByNum.get(source.seedNum) ?? null;
  }

  const upstream = slotsByKey.get(source.slotKey);
  if (!upstream) {
    return null;
  }

  if (source.takes === 'winner' && upstream.winnerId) {
    return upstream.winnerId;
  }
  if (source.takes === 'loser' && upstream.loserId) {
    return upstream.loserId;
  }

  if (!upstream.match || !DECIDED_MATCH_STATUSES.has(upstream.match.status)) {
    return null;
  }

  try {
    const outcome = computeMatchWinner({
      player1Id: upstream.match.player1Id,
      player2Id: upstream.match.player2Id,
      gameResults: upstream.match.gameResults,
    });
    return source.takes === 'winner' ? outcome.winnerId : outcome.loserId;
  } catch {
    return null;
  }
}

export function resolveBracketSlotParticipants(
  definitionSlot: { source1: SlotSource; source2: SlotSource },
  slotsByKey: Map<string, BracketSlotWithMatch>,
  seedByNum: Map<number, string>,
) {
  return {
    player1Id: resolveBracketParticipantUserId(definitionSlot.source1, slotsByKey, seedByNum),
    player2Id: resolveBracketParticipantUserId(definitionSlot.source2, slotsByKey, seedByNum),
  };
}

async function createBracketMatchForSlot(eventId: string, readySlot: BracketSlotWithMatch & { id: string }) {
  let round = await prisma.round.findFirst({
    where: {
      eventId,
      roundNumber: slotRoundNumber(readySlot),
    },
  });
  if (!round) {
    round = await prisma.round.create({
      data: {
        eventId,
        roundNumber: slotRoundNumber(readySlot),
        status: 'in_progress',
      },
    });
  }

  const createdMatch = await prisma.match.create({
    data: {
      roundId: round.id,
      player1Id: readySlot.player1Id!,
      player2Id: readySlot.player2Id!,
      isBye: false,
      status: 'pending',
    },
  });

  await prisma.bracketSlot.update({
    where: { id: readySlot.id },
    data: { matchId: createdMatch.id },
  });
}

export async function syncBracketPairings(eventId: string) {
  const { event, seeds } = await getEventWithSeeds(eventId);
  if (!isBracketFormat(event.config.format)) {
    return;
  }

  const definition = getBracketDefinition(event.config.format, Math.max(seeds.length, 2));
  const seedByNum = new Map(seeds.map((seed) => [seed.seedNum, seed.userId]));
  const definitionByKey = new Map(definition.slots.map((slot) => [slot.slotKey, slot]));

  let slots = await prisma.bracketSlot.findMany({
    where: { eventId },
    include: {
      match: {
        include: {
          gameResults: {
            select: {
              winnerId: true,
              isDraw: true,
            },
          },
        },
      },
    },
  });

  const slotsByKey = new Map(slots.map((slot) => [slot.slotKey, slot as BracketSlotWithMatch]));

  for (const slot of slots) {
    if (slot.slotKey === 'RESET') {
      continue;
    }

    const definitionSlot = definitionByKey.get(slot.slotKey);
    if (!definitionSlot) {
      continue;
    }

    const resolved = resolveBracketSlotParticipants(definitionSlot, slotsByKey, seedByNum);
    const updates: { player1Id?: string; player2Id?: string } = {};
    if (resolved.player1Id && slot.player1Id !== resolved.player1Id) {
      updates.player1Id = resolved.player1Id;
    }
    if (resolved.player2Id && slot.player2Id !== resolved.player2Id) {
      updates.player2Id = resolved.player2Id;
    }

    if (Object.keys(updates).length === 0) {
      continue;
    }

    const updated = await prisma.bracketSlot.update({
      where: { id: slot.id },
      data: updates,
    });
    Object.assign(slot, updated);
    slotsByKey.set(slot.slotKey, slot as BracketSlotWithMatch);
  }

  slots = await prisma.bracketSlot.findMany({
    where: { eventId },
    include: {
      match: {
        include: {
          gameResults: {
            select: {
              winnerId: true,
              isDraw: true,
            },
          },
        },
      },
    },
  });

  for (const readySlot of slots) {
    if (!readySlot.player1Id || !readySlot.player2Id || readySlot.matchId) {
      continue;
    }

    await createBracketMatchForSlot(eventId, readySlot);
  }
}

async function getEventWithSeeds(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      config: true,
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
  if (!event || !event.config) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  const seeds = await prisma.eventSeed.findMany({
    where: { eventId },
    orderBy: { seedNum: 'asc' },
  });
  return { event, seeds };
}

function validatePersistedSeeds(
  seeds: Array<{ userId: string; seedNum: number }>,
  memberIds: string[],
) {
  if (seeds.length !== memberIds.length) {
    throw new AppError(409, 'SEEDS_INCOMPLETE', 'Seeds must include every league member exactly once');
  }

  const memberSet = new Set(memberIds);
  const uniqueUserIds = new Set(seeds.map((seed) => seed.userId));
  const uniqueSeedNums = new Set(seeds.map((seed) => seed.seedNum));
  if (uniqueUserIds.size !== seeds.length || uniqueSeedNums.size !== seeds.length) {
    throw new AppError(409, 'SEEDS_INCOMPLETE', 'Seed users and seed numbers must be unique');
  }

  const hasNonMember = seeds.some((seed) => !memberSet.has(seed.userId));
  if (hasNonMember) {
    throw new AppError(409, 'SEEDS_INCOMPLETE', 'All seeds must belong to league members');
  }
}

export async function ensureBracketSeeds(eventId: string) {
  const { event, seeds: existingSeeds } = await getEventWithSeeds(eventId);
  const memberIds = event.season.league.memberships.map((membership) => membership.userId);
  const source = event.config.seedingSource;

  if (source === 'manual') {
    if (existingSeeds.length === 0) {
      throw new AppError(409, 'SEEDS_NOT_SET', 'Manual seeds must be set before starting the event');
    }
    validatePersistedSeeds(existingSeeds, memberIds);
    return existingSeeds;
  }

  if (!source) {
    throw new AppError(
      409,
      'SEEDING_SOURCE_REQUIRED',
      'Bracket events require a seeding source before start',
    );
  }

  const ordered = await resolveSeededPlayerOrder(eventId, { strict: true });
  if (ordered.length !== memberIds.length) {
    throw new AppError(409, 'SEEDS_INCOMPLETE', 'Seeding source did not produce a complete player order');
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventSeed.deleteMany({ where: { eventId } });
    await tx.eventSeed.createMany({
      data: ordered.map((userId, index) => ({
        eventId,
        userId,
        seedNum: index + 1,
      })),
    });
  });

  return prisma.eventSeed.findMany({
    where: { eventId },
    orderBy: { seedNum: 'asc' },
  });
}

export async function validateBracketStart(eventId: string) {
  const { event, seeds } = await getEventWithSeeds(eventId);
  if (!isBracketFormat(event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Event is not configured for bracket play');
  }

  const memberIds = event.season.league.memberships.map((membership) => membership.userId);
  const playerCount = memberIds.length;
  if (event.config.format === 'custom_10_player' && playerCount !== 10) {
    throw new AppError(400, 'INVALID_PLAYER_COUNT', 'Custom 10-player bracket requires exactly 10 players');
  }
  if (event.config.format !== 'custom_10_player' && (playerCount < 2 || playerCount > 16)) {
    throw new AppError(400, 'INVALID_PLAYER_COUNT', 'Bracket formats require between 2 and 16 players');
  }

  if (seeds.length === 0) {
    throw new AppError(409, 'SEEDS_NOT_SET', 'Bracket seeds must be set before starting the event');
  }
  validatePersistedSeeds(seeds, memberIds);
  return { event, seeds, playerCount };
}

export async function initializeBracket(eventId: string) {
  const { event, seeds, playerCount } = await validateBracketStart(eventId);
  const definition = getBracketDefinition(event.config.format, playerCount);
  const seedByNum = new Map(seeds.map((seed) => [seed.seedNum, seed.userId]));

  const slotRows = definition.slots.map((slot) => ({
    eventId,
    slotKey: slot.slotKey,
    bracketSide: slot.bracketSide,
    bracketRound: slot.bracketRound,
    player1Id: slot.source1.type === 'seed' ? seedByNum.get(slot.source1.seedNum) ?? null : null,
    player2Id: slot.source2.type === 'seed' ? seedByNum.get(slot.source2.seedNum) ?? null : null,
  }));

  await prisma.bracketSlot.deleteMany({ where: { eventId } });
  await prisma.bracketSlot.createMany({ data: slotRows });

  const firstWave = slotRows.filter((slot) => slot.player1Id && slot.player2Id);
  if (firstWave.length === 0) {
    return;
  }

  const round = await prisma.round.create({
    data: {
      eventId,
      roundNumber: 1,
      status: 'in_progress',
    },
  });

  for (const slot of firstWave) {
    const match = await prisma.match.create({
      data: {
        roundId: round.id,
        player1Id: slot.player1Id!,
        player2Id: slot.player2Id!,
        isBye: false,
        status: 'pending',
      },
    });
    await prisma.bracketSlot.update({
      where: { eventId_slotKey: { eventId, slotKey: slot.slotKey } },
      data: { matchId: match.id },
    });
  }
}

export async function advanceBracket(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      gameResults: {
        select: {
          winnerId: true,
          isDraw: true,
        },
      },
      round: {
        include: {
          event: {
            include: { config: true },
          },
        },
      },
    },
  });
  if (!match || !match.round.event.config) {
    throw new AppError(404, 'NOT_FOUND', 'Match not found');
  }
  if (!isBracketFormat(match.round.event.config.format)) {
    return;
  }

  const slot = await prisma.bracketSlot.findUnique({
    where: { matchId },
  });
  if (!slot) {
    throw new AppError(404, 'NOT_FOUND', 'Bracket slot not found for match');
  }
  if (slot.winnerId) {
    return;
  }

  const { winnerId, loserId } = computeMatchWinner(match);

  await prisma.bracketSlot.update({
    where: { id: slot.id },
    data: { winnerId, loserId },
  });

  const { seeds, event } = await getEventWithSeeds(slot.eventId);
  const definition = getBracketDefinition(match.round.event.config.format, Math.max(seeds.length, 2));
  const downstream = getDownstreamSlots(definition, slot.slotKey);

  const shouldApplyFinalReset =
    slot.slotKey === 'FIN'
      ? Boolean(
          match.round.event.config.grandFinalsReset &&
            match.player2Id &&
            winnerId === match.player2Id,
        )
      : true;

  if (downstream.winnerGoesTo && shouldApplyFinalReset) {
    const winnerField = downstream.winnerGoesTo.position === 1 ? 'player1Id' : 'player2Id';
    await prisma.bracketSlot.update({
      where: { eventId_slotKey: { eventId: slot.eventId, slotKey: downstream.winnerGoesTo.slotKey } },
      data: { [winnerField]: winnerId },
    });
  }

  if (downstream.loserGoesTo && shouldApplyFinalReset) {
    const loserField = downstream.loserGoesTo.position === 1 ? 'player1Id' : 'player2Id';
    await prisma.bracketSlot.update({
      where: { eventId_slotKey: { eventId: slot.eventId, slotKey: downstream.loserGoesTo.slotKey } },
      data: { [loserField]: loserId },
    });
  }

  await syncBracketPairings(slot.eventId);

  const refreshed = await prisma.bracketSlot.findMany({
    where: { eventId: slot.eventId },
  });
  const resetMatch = refreshed.find((bracketSlot) => bracketSlot.slotKey === 'RESET');
  const hasOutstanding = refreshed.some((bracketSlot) => {
    if (!bracketSlot.matchId) {
      return false;
    }
    if (bracketSlot.slotKey === 'RESET' && !event.config?.grandFinalsReset) {
      return false;
    }
    if (bracketSlot.slotKey === 'RESET' && event.config?.grandFinalsReset && !resetMatch?.player1Id) {
      return false;
    }
    return !bracketSlot.winnerId;
  });

  if (!hasOutstanding) {
    await prisma.event.update({
      where: { id: slot.eventId },
      data: { status: 'completed' },
    });
  }
}

export async function resetBracketEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.gameResult.deleteMany({
      where: {
        match: {
          round: {
            eventId,
          },
        },
      },
    });
    await tx.match.deleteMany({
      where: {
        round: {
          eventId,
        },
      },
    });
    await tx.round.deleteMany({
      where: { eventId },
    });
    await tx.bracketSlot.deleteMany({
      where: { eventId },
    });
    await tx.event.update({
      where: { id: eventId },
      data: { status: 'setup', totalRounds: null },
    });
  });
}

export async function getBracketState(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      config: true,
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
  if (!event || !event.config) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  if (isBracketFormat(event.config.format) && event.status === 'active') {
    await syncBracketPairings(eventId);
  }

  const definition = getBracketDefinition(event.config.format, event.season.league.memberships.length);
  const definitionByKey = new Map(definition.slots.map((slot) => [slot.slotKey, slot]));

  const slots = await prisma.bracketSlot.findMany({
    where: { eventId },
    include: {
      player1: true,
      player2: true,
      winner: true,
      loser: true,
      match: {
        include: {
          gameResults: true,
          player1: true,
          player2: true,
        },
      },
    },
    orderBy: [{ bracketSide: 'asc' }, { bracketRound: 'asc' }],
  });
  return slots.map((slot) => {
    const definitionSlot = definitionByKey.get(slot.slotKey);
    return {
      ...slot,
      col: definitionSlot?.col ?? 1,
      row: definitionSlot?.row ?? 1,
      source1: definitionSlot?.source1 ?? null,
      source2: definitionSlot?.source2 ?? null,
    };
  });
}

export function createBracketService() {
  return {
    validateBracketStart,
    initializeBracket,
    advanceBracket,
    syncBracketPairings,
    resetBracketEvent,
    getBracketState,
  };
}
