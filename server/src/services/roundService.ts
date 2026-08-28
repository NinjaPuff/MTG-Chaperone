import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import {
  generateSeededSwissPairings,
  generateSwissPairings,
  regeneratePairings,
} from './pairingService.js';
import { unlockDecklistsForRound } from './decklistService.js';
import { isBracketFormat, isPairingFormat, isSwissFormat, supportsRegeneratePairings, type PairingEventFormat } from '@mtg-league/shared';

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

async function pairRoundByFormat(roundId: string, format: 'swiss' | 'seeded_swiss') {
  if (format === 'swiss') {
    const pairs = await generateSwissPairings(roundId);
    await createMatchesForRound(roundId, pairs);
    return;
  }

  const pairs = await generateSeededSwissPairings(roundId);
  await createMatchesForRound(roundId, pairs);
}

async function tryAutoCompleteEvent(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    include: {
      rounds: {
        select: { status: true },
      },
    },
  });
  if (!event || event.status !== 'active' || event.totalRounds === null) {
    return;
  }

  if (event.rounds.length < event.totalRounds) {
    return;
  }

  if (!event.rounds.every((round) => round.status === 'completed')) {
    return;
  }

  await tx.event.update({
    where: { id: eventId },
    data: { status: 'completed' },
  });
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
  if (isBracketFormat(event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Bracket events do not support manual round creation');
  }
  if (event.config.format === 'round_robin') {
    throw new AppError(409, 'INVALID_OPERATION', 'Round robin events do not support manual round creation');
  }
  if (!isSwissFormat(event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Unsupported event format for manual round creation');
  }
  const swissFormat = event.config.format;

  const emptyRoundShell = await prisma.round.findFirst({
    where: {
      eventId,
      status: 'not_started',
      matches: {
        none: {},
      },
    },
    orderBy: {
      roundNumber: 'asc',
    },
  });
  if (emptyRoundShell) {
    await pairRoundByFormat(emptyRoundShell.id, swissFormat);
    return prisma.round.findUnique({
      where: { id: emptyRoundShell.id },
      include: { matches: true },
    });
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

  await pairRoundByFormat(round.id, swissFormat);

  return prisma.round.findUnique({
    where: { id: round.id },
    include: { matches: true },
  });
}

export async function startRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      event: {
        select: { status: true },
      },
    },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }
  if (round.event.status !== 'active') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Event must be active before starting rounds');
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
    include: {
      matches: true,
      event: {
        include: {
          config: true,
        },
      },
    },
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

    const updatedRound = await tx.round.update({
      where: { id: roundId },
      data: { status: 'completed' },
    });

    if (round.event.config?.format !== 'round_robin') {
      const deckCount = Math.max(1, round.event.config?.deckCount ?? 1);
      await tx.decklist.updateMany({
        where: {
          eventId: round.eventId,
          status: 'submitted',
          orderIndex: { lt: deckCount },
        },
        data: {
          status: 'locked',
        },
      });
    }

    await tryAutoCompleteEvent(tx, round.eventId);

    return updatedRound;
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
  if (!supportsRegeneratePairings(round.event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Regenerate pairings is only supported for swiss events');
  }

  await regeneratePairings(roundId);

  if (round.event.config.format === 'swiss') {
    await pairRoundByFormat(roundId, 'swiss');
  } else {
    await pairRoundByFormat(roundId, 'seeded_swiss');
  }
}

export async function resetRoundProgress(
  tx: Prisma.TransactionClient,
  round: {
    id: string;
    event: {
      config: {
        format: PairingEventFormat;
      } | null;
    };
  },
) {
  await tx.gameResult.deleteMany({
    where: {
      match: {
        roundId: round.id,
      },
    },
  });
  await tx.match.deleteMany({
    where: {
      roundId: round.id,
    },
  });
  await unlockDecklistsForRound(tx, round.id);
  await tx.round.update({
    where: { id: round.id },
    data: { status: 'not_started' },
  });
}

export async function resetRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      matches: {
        select: { player1Id: true, player2Id: true, isBye: true },
      },
      event: {
        include: {
          config: true,
        },
      },
    },
  });
  if (!round || !round.event.config) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }
  if (isBracketFormat(round.event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Bracket rounds can only be reset by resetting the entire event');
  }
  if (!isPairingFormat(round.event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Unsupported event format for round reset');
  }
  const pairingFormat = round.event.config.format;
  if (round.status === 'not_started') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Round is already not started. Use regenerate to reroll pairings');
  }

  const savedPairs = (round.matches ?? []).map((match) => ({
    player1Id: match.player1Id,
    player2Id: match.player2Id,
    isBye: match.isBye,
  }));

  await prisma.$transaction(async (tx) => {
    await resetRoundProgress(tx, {
      id: round.id,
      event: {
        config: {
          format: pairingFormat,
        },
      },
    });
    if (round.event.status === 'completed') {
      await tx.event.update({
        where: { id: round.eventId },
        data: { status: 'active' },
      });
    }
  });

  if (round.event.config.format === 'swiss') {
    await pairRoundByFormat(roundId, 'swiss');
  } else if (round.event.config.format === 'seeded_swiss') {
    await pairRoundByFormat(roundId, 'seeded_swiss');
  } else {
    await createMatchesForRound(roundId, savedPairs);
  }

  return prisma.round.findUnique({
    where: { id: roundId },
    include: { matches: true },
  });
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
  if (round.event.config?.format && isBracketFormat(round.event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Bracket rounds can only be deleted by resetting the entire event');
  }
  validateRoundTransition(round.status, 'delete');

  const referencingDecklists = await prisma.decklist.count({
    where: { roundId },
  });
  if (referencingDecklists > 0) {
    throw new AppError(409, 'CONFLICT', 'Cannot delete a round while decklists still reference it');
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

export function createRoundService() {
  return {
    validateRoundTransition,
    createRound,
    startRound,
    completeRound,
    regenerateRoundPairings,
    resetRound,
    deleteRound,
  };
}
