import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type GameInput = {
  winnerId?: string | null;
  isDraw?: boolean;
  notes?: string;
};

type MatchAction = 'report' | 'confirm' | 'dispute' | 'resolve';

export function validateMatchStateTransition(
  currentStatus: 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved',
  action: MatchAction,
  reporterId: string | null,
  actingUserId: string,
) {
  if (action === 'report' && currentStatus !== 'pending') {
    throw new AppError(409, 'INVALID_MATCH_STATE', 'Only pending matches can be reported');
  }
  if (action === 'confirm') {
    if (currentStatus !== 'reported') {
      throw new AppError(409, 'INVALID_MATCH_STATE', 'Only reported matches can be confirmed');
    }
    if (reporterId === actingUserId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Reporter cannot confirm their own match');
    }
  }
  if (action === 'dispute') {
    if (currentStatus !== 'reported') {
      throw new AppError(409, 'INVALID_MATCH_STATE', 'Only reported matches can be disputed');
    }
    if (reporterId === actingUserId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Reporter cannot dispute their own report');
    }
  }
  if (action === 'resolve' && !['reported', 'disputed'].includes(currentStatus)) {
    throw new AppError(409, 'INVALID_MATCH_STATE', 'Only reported or disputed matches can be resolved');
  }
}

async function getMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: {
        include: {
          event: {
            include: { season: true },
          },
        },
      },
      gameResults: true,
    },
  });
  if (!match) {
    throw new AppError(404, 'NOT_FOUND', 'Match not found');
  }
  return match;
}

function ensureParticipant(match: Awaited<ReturnType<typeof getMatch>>, userId: string) {
  if (match.player1Id !== userId && match.player2Id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only match participants can perform this action');
  }
}

async function ensureSiteAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
}

async function ensureParticipantOrSiteAdmin(match: Awaited<ReturnType<typeof getMatch>>, userId: string) {
  if (match.player1Id === userId || match.player2Id === userId) {
    return;
  }
  await ensureSiteAdmin(userId);
}

async function writeGameResults(matchId: string, gameResults: GameInput[]) {
  await prisma.gameResult.deleteMany({ where: { matchId } });
  await Promise.all(
    gameResults.map((game, index) =>
      prisma.gameResult.create({
        data: {
          matchId,
          gameNumber: index + 1,
          winnerId: game.isDraw ? null : game.winnerId ?? null,
          isDraw: game.isDraw ?? false,
          notes: game.notes ?? null,
        },
      }),
    ),
  );
}

async function tryAutoCompleteRound(tx: typeof prisma, roundId: string) {
  const round = await tx.round.findUnique({
    where: { id: roundId },
    include: {
      matches: {
        select: { status: true },
      },
    },
  });

  if (!round || round.status !== 'in_progress') {
    return;
  }

  const allMatchesFinished = round.matches.every((roundMatch) => ['confirmed', 'resolved'].includes(roundMatch.status));
  if (!allMatchesFinished) {
    return;
  }

  await tx.round.update({
    where: { id: roundId },
    data: { status: 'completed' },
  });

  const event = await tx.event.findUnique({
    where: { id: round.eventId },
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
  if (!event.rounds.every((eventRound) => eventRound.status === 'completed')) {
    return;
  }

  await tx.event.update({
    where: { id: event.id },
    data: { status: 'completed' },
  });
}

export async function reportMatch(matchId: string, reporterId: string, gameResults: GameInput[]) {
  const match = await getMatch(matchId);
  await ensureParticipantOrSiteAdmin(match, reporterId);
  if (match.round.status !== 'in_progress') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Round must be in progress to report matches');
  }
  validateMatchStateTransition(match.status, 'report', match.reportedById ?? null, reporterId);
  if (gameResults.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one game result is required');
  }

  await writeGameResults(matchId, gameResults);

  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'reported',
      reportedById: reporterId,
    },
    include: { gameResults: true },
  });
}

export async function confirmMatch(matchId: string, confirmerId: string) {
  const match = await getMatch(matchId);
  ensureParticipant(match, confirmerId);
  validateMatchStateTransition(match.status, 'confirm', match.reportedById ?? null, confirmerId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
      include: { gameResults: true },
    });

    await tryAutoCompleteRound(tx, match.roundId);

    return updated;
  });
}

export async function disputeMatch(matchId: string, disputerId: string) {
  const match = await getMatch(matchId);
  ensureParticipant(match, disputerId);
  validateMatchStateTransition(match.status, 'dispute', match.reportedById ?? null, disputerId);

  return prisma.match.update({
    where: { id: matchId },
    data: { status: 'disputed' },
    include: { gameResults: true },
  });
}

export async function resolveMatch(matchId: string, adminId: string, gameResults: GameInput[]) {
  await ensureSiteAdmin(adminId);
  const match = await getMatch(matchId);
  validateMatchStateTransition(match.status, 'resolve', match.reportedById ?? null, adminId);

  await writeGameResults(matchId, gameResults);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        status: 'resolved',
        confirmedAt: new Date(),
      },
      include: { gameResults: true },
    });

    await tryAutoCompleteRound(tx, match.roundId);

    return updated;
  });
}

export function createMatchService() {
  return {
    validateMatchStateTransition,
    reportMatch,
    confirmMatch,
    disputeMatch,
    resolveMatch,
  };
}
