import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import {
  assignRoundRobinPairings,
  generateRoundRobinSchedule,
  generateSeededSwissPairings,
  generateSwissPairings,
  regeneratePairings,
} from './pairingService.js';

type RoundTransitionAction = 'start' | 'complete' | 'delete';

export function validateRoundTransition(
  currentStatus: 'not_started' | 'in_progress' | 'completed',
  action: RoundTransitionAction,
  matches: Array<{ status: 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved' }> = [],
) {
  if (action === 'start' && currentStatus !== 'not_started') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Round already started');
  }

  if (action === 'complete') {
    if (currentStatus !== 'in_progress') {
      throw new AppError(409, 'INVALID_ROUND_STATE', 'Round is not in progress');
    }
    const unresolved = matches.find((match) => !['reported', 'confirmed', 'resolved'].includes(match.status));
    if (unresolved) {
      throw new AppError(409, 'MATCH_INCOMPLETE', 'All matches must be reported before completing the round');
    }
  }

  if (action === 'delete' && !['in_progress', 'completed'].includes(currentStatus)) {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Only in-progress or completed rounds can be deleted');
  }
}

async function createMatchesForRound(roundId: string, pairs: Array<{ player1Id: string; player2Id: string | null; isBye: boolean }>) {
  return Promise.all(
    pairs.map((pair) =>
      prisma.match.create({
        data: {
          roundId,
          player1Id: pair.player1Id,
          player2Id: pair.player2Id,
          isBye: pair.isBye,
          status: pair.isBye ? 'confirmed' : 'pending',
          confirmedAt: pair.isBye ? new Date() : null,
        },
      }),
    ),
  );
}

export async function createRound(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      config: true,
      rounds: {
        orderBy: { roundNumber: 'desc' },
        take: 1,
      },
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
  if (event.config.format === 'round_robin') {
    throw new AppError(409, 'INVALID_OPERATION', 'Round robin events do not support manual round creation');
  }

  const existingRoundCount = await prisma.round.findMany({
    where: { eventId },
    select: { id: true },
  });
  if (event.totalRounds !== null && event.totalRounds !== undefined && existingRoundCount.length >= event.totalRounds) {
    throw new AppError(409, 'MAX_ROUNDS_REACHED', 'Event has reached its maximum number of rounds');
  }

  const round = await prisma.round.create({
    data: {
      eventId,
      roundNumber: (event.rounds[0]?.roundNumber || 0) + 1,
      status: 'not_started',
    },
  });

  if (event.config.format === 'swiss') {
    const pairs = await generateSwissPairings(round.id);
    await createMatchesForRound(round.id, pairs);
  } else if (event.config.format === 'seeded_swiss') {
    const pairs = await generateSeededSwissPairings(round.id);
    await createMatchesForRound(round.id, pairs);
  } else {
    const players = event.season.league.memberships.map((membership) => membership.userId);
    const hasSchedule = await prisma.roundRobinSchedule.findUnique({ where: { seasonId: event.seasonId } });
    if (!hasSchedule) {
      await generateRoundRobinSchedule(event.seasonId, players);
    }
    await assignRoundRobinPairings(round.id);
  }

  return prisma.round.findUnique({
    where: { id: round.id },
    include: { matches: true },
  });
}

export async function startRound(roundId: string) {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }
  validateRoundTransition(round.status, 'start');
  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'in_progress' },
  });
}

export async function completeRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { matches: true },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }
  validateRoundTransition(round.status, 'complete', round.matches);

  return prisma.$transaction(async (tx) => {
    await tx.match.updateMany({
      where: { roundId, status: 'reported' },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });

    return tx.round.update({
      where: { id: roundId },
      data: { status: 'completed' },
    });
  });
}

export async function regenerateRoundPairings(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { event: { include: { config: true } } },
  });
  if (!round || !round.event.config) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }
  if (round.status !== 'not_started') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Only not started rounds can regenerate pairings');
  }

  await regeneratePairings(roundId);

  if (round.event.config.format === 'swiss') {
    const pairs = await generateSwissPairings(roundId);
    await createMatchesForRound(roundId, pairs);
  } else if (round.event.config.format === 'seeded_swiss') {
    const pairs = await generateSeededSwissPairings(roundId);
    await createMatchesForRound(roundId, pairs);
  } else {
    await assignRoundRobinPairings(roundId);
  }
}

export async function deleteRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      event: {
        include: { config: true },
      },
    },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }
  validateRoundTransition(round.status, 'delete');

  await prisma.$transaction(async (tx) => {
    if (round.event.config?.format === 'round_robin') {
      await tx.scheduledPairing.updateMany({
        where: { roundId },
        data: { roundId: null },
      });
    }

    await tx.round.delete({
      where: { id: roundId },
    });
  });

  return { seasonId: round.event.seasonId };
}

export function createRoundService() {
  return {
    validateRoundTransition,
    createRound,
    startRound,
    completeRound,
    regenerateRoundPairings,
    deleteRound,
  };
}
