import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import {
  assignRoundRobinPairings,
  generateRoundRobinSchedule,
  generateSeededSwissPairings,
  generateSwissPairings,
  regeneratePairings,
} from './pairingService.js';

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
    const existingPreparedRound = await prisma.round.findFirst({
      where: {
        eventId,
        status: 'not_started',
      },
      select: { id: true },
    });
    if (existingPreparedRound) {
      throw new AppError(409, 'ROUND_ALREADY_PREPARED', 'A round is already prepared for this event');
    }
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
  if (round.status !== 'not_started') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Round already started');
  }
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
  if (round.status !== 'in_progress') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Round is not in progress');
  }

  const unresolved = round.matches.find((match) => !['confirmed', 'resolved'].includes(match.status));
  if (unresolved) {
    throw new AppError(409, 'MATCH_INCOMPLETE', 'All matches must be confirmed before completing the round');
  }

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'completed' },
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
  if (!['in_progress', 'completed'].includes(round.status)) {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Only in-progress or completed rounds can be deleted');
  }

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
