import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type GameInput = {
  winnerId?: string | null;
  isDraw?: boolean;
  notes?: string;
};

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

export async function reportMatch(matchId: string, reporterId: string, gameResults: GameInput[]) {
  const match = await getMatch(matchId);
  ensureParticipant(match, reporterId);
  if (match.status !== 'pending') {
    throw new AppError(409, 'INVALID_MATCH_STATE', 'Only pending matches can be reported');
  }
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
  if (match.status !== 'reported') {
    throw new AppError(409, 'INVALID_MATCH_STATE', 'Only reported matches can be confirmed');
  }
  if (match.reportedById === confirmerId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Reporter cannot confirm their own match');
  }

  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'confirmed',
      confirmedAt: new Date(),
    },
    include: { gameResults: true },
  });
}

export async function disputeMatch(matchId: string, disputerId: string) {
  const match = await getMatch(matchId);
  ensureParticipant(match, disputerId);
  if (match.status !== 'reported') {
    throw new AppError(409, 'INVALID_MATCH_STATE', 'Only reported matches can be disputed');
  }
  if (match.reportedById === disputerId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Reporter cannot dispute their own report');
  }

  return prisma.match.update({
    where: { id: matchId },
    data: { status: 'disputed' },
    include: { gameResults: true },
  });
}

export async function resolveMatch(matchId: string, adminId: string, gameResults: GameInput[]) {
  await ensureSiteAdmin(adminId);
  const match = await getMatch(matchId);
  if (!['reported', 'disputed'].includes(match.status)) {
    throw new AppError(409, 'INVALID_MATCH_STATE', 'Only reported or disputed matches can be resolved');
  }

  await writeGameResults(matchId, gameResults);

  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'resolved',
      confirmedAt: new Date(),
    },
    include: { gameResults: true },
  });
}
