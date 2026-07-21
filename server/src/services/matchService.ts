import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { isBracketFormat } from '@mtg-league/shared';
import { advanceBracket, syncBracketPairings } from './bracketService.js';

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
            include: { season: true, config: true },
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

async function lockDecklistsForMatchParticipants(
  client: Pick<Prisma.TransactionClient, 'decklist'> | Pick<typeof prisma, 'decklist'>,
  roundId: string,
  playerIds: string[],
) {
  if (playerIds.length === 0) {
    return;
  }
  await client.decklist.updateMany({
    where: {
      roundId,
      userId: { in: playerIds },
      status: 'submitted',
    },
    data: { status: 'locked' },
  });
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

export function validateGameResults(
  player1Id: string,
  player2Id: string | null,
  gameResults: GameInput[],
) {
  if (gameResults.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one game result is required');
  }

  for (const game of gameResults) {
    if (game.isDraw) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Game draws are not supported');
    }
  }

  if (!player2Id) {
    return;
  }
}

function assertBracketMatchHasWinner(
  format: string | undefined,
  player1Id: string,
  player2Id: string | null,
  gameResults: GameInput[],
) {
  if (!format || !player2Id || !isBracketFormat(format)) {
    return;
  }

  let player1Wins = 0;
  let player2Wins = 0;
  for (const game of gameResults) {
    if (game.winnerId === player1Id) {
      player1Wins += 1;
    } else if (game.winnerId === player2Id) {
      player2Wins += 1;
    }
  }

  if (player1Wins === player2Wins) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Bracket matches must produce a winner');
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

async function tryAutoCompleteRound(tx: Prisma.TransactionClient, roundId: string) {
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
  validateGameResults(match.player1Id, match.player2Id, gameResults);
  assertBracketMatchHasWinner(
    match.round.event.config?.format,
    match.player1Id,
    match.player2Id,
    gameResults,
  );

  await writeGameResults(matchId, gameResults);

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'reported',
      reportedById: reporterId,
    },
    include: { gameResults: true },
  });
  if (match.round.event.config?.format !== 'round_robin') {
    await lockDecklistsForMatchParticipants(
      prisma,
      match.roundId,
      [match.player1Id, match.player2Id].filter((id): id is string => Boolean(id)),
    );
  }
  if (match.round.event.config && isBracketFormat(match.round.event.config.format)) {
    await syncBracketPairings(match.round.eventId);
  }
  return updated;
}

export async function confirmMatch(matchId: string, confirmerId: string) {
  const match = await getMatch(matchId);
  ensureParticipant(match, confirmerId);
  validateMatchStateTransition(match.status, 'confirm', match.reportedById ?? null, confirmerId);

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
      include: { gameResults: true },
    });

    if (match.round.event.config?.format !== 'round_robin') {
      await lockDecklistsForMatchParticipants(
        tx,
        match.roundId,
        [match.player1Id, match.player2Id].filter((id): id is string => Boolean(id)),
      );
    }

    await tryAutoCompleteRound(tx, match.roundId);

    return updated;
  });
  if (match.round.event.config && isBracketFormat(match.round.event.config.format)) {
    await advanceBracket(matchId);
  }
  return updated;
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
  validateGameResults(match.player1Id, match.player2Id, gameResults);
  assertBracketMatchHasWinner(
    match.round.event.config?.format,
    match.player1Id,
    match.player2Id,
    gameResults,
  );

  await writeGameResults(matchId, gameResults);

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        status: 'resolved',
        confirmedAt: new Date(),
      },
      include: { gameResults: true },
    });

    if (match.round.event.config?.format !== 'round_robin') {
      await lockDecklistsForMatchParticipants(
        tx,
        match.roundId,
        [match.player1Id, match.player2Id].filter((id): id is string => Boolean(id)),
      );
    }

    await tryAutoCompleteRound(tx, match.roundId);

    return updated;
  });
  if (match.round.event.config && isBracketFormat(match.round.event.config.format)) {
    await advanceBracket(matchId);
  }
  return updated;
}

export async function updateMatchPlayers(
  matchId: string,
  updates: { player1Id?: string; player2Id?: string | null },
) {
  const match = await getMatch(matchId);

  if (match.round.status !== 'not_started') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Pairings can only be edited before the round starts');
  }

  if (match.round.event.config && isBracketFormat(match.round.event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Bracket pairings cannot be manually edited');
  }

  const nextPlayer1Id = updates.player1Id ?? match.player1Id;
  const nextPlayer2Id = updates.player2Id !== undefined ? updates.player2Id : match.player2Id;
  const nextIsBye = nextPlayer2Id === null;

  if (!nextIsBye && nextPlayer1Id === nextPlayer2Id) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Player 1 and player 2 must be different');
  }

  const leagueId = match.round.event.season.leagueId;
  const memberships = await prisma.leagueMembership.findMany({
    where: { leagueId },
    select: { userId: true },
  });
  const memberIds = new Set(memberships.map((membership) => membership.userId));

  const submittedPlayerIds = [updates.player1Id, updates.player2Id]
    .filter((playerId): playerId is string => typeof playerId === 'string');

  for (const playerId of submittedPlayerIds) {
    if (!memberIds.has(playerId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'All players must be league members');
    }
  }

  const siblingMatches = await prisma.match.findMany({
    where: { roundId: match.roundId, id: { not: matchId } },
    select: { player1Id: true, player2Id: true },
  });

  for (const playerId of submittedPlayerIds) {
    const duplicate = siblingMatches.some(
      (sibling) => sibling.player1Id === playerId || sibling.player2Id === playerId,
    );
    if (duplicate) {
      throw new AppError(409, 'DUPLICATE_PLAYER', 'Player is already paired in another match this round');
    }
  }

  const updateData: Prisma.MatchUpdateInput = {};

  if (updates.player1Id !== undefined) {
    updateData.player1 = { connect: { id: updates.player1Id } };
  }

  if (updates.player2Id !== undefined) {
    if (updates.player2Id === null) {
      updateData.player2 = { disconnect: true };
      updateData.isBye = true;
      updateData.status = 'confirmed';
      updateData.confirmedAt = new Date();
    } else {
      updateData.player2 = { connect: { id: updates.player2Id } };
      if (match.isBye || match.player2Id === null) {
        updateData.isBye = false;
        updateData.status = 'pending';
        updateData.confirmedAt = null;
      }
    }
  }

  const oldPlayer1Id = match.player1Id;
  const oldPlayer2Id = match.player2Id;
  const shouldSyncScheduledPairing = !nextIsBye && nextPlayer2Id !== null;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: updateData,
      include: {
        player1: true,
        player2: true,
        gameResults: true,
      },
    });

    if (shouldSyncScheduledPairing && oldPlayer2Id) {
      await tx.scheduledPairing.updateMany({
        where: {
          roundId: match.roundId,
          OR: [
            { player1Id: oldPlayer1Id, player2Id: oldPlayer2Id },
            { player1Id: oldPlayer2Id, player2Id: oldPlayer1Id },
          ],
        },
        data: {
          player1Id: nextPlayer1Id,
          player2Id: nextPlayer2Id,
        },
      });
    }

    return updated;
  });
}

type RoundPairingInput = { matchId?: string; player1Id: string; player2Id: string | null };

function buildMatchPairingUpdateData(
  current: { player1Id: string; player2Id: string | null; isBye: boolean },
  next: { player1Id: string; player2Id: string | null },
): Prisma.MatchUpdateInput | null {
  const player1Changed = next.player1Id !== current.player1Id;
  const player2Changed = next.player2Id !== current.player2Id;
  if (!player1Changed && !player2Changed) {
    return null;
  }

  const updateData: Prisma.MatchUpdateInput = {};

  if (player1Changed) {
    updateData.player1 = { connect: { id: next.player1Id } };
  }

  if (player2Changed) {
    if (next.player2Id === null) {
      updateData.player2 = { disconnect: true };
      updateData.isBye = true;
      updateData.status = 'confirmed';
      updateData.confirmedAt = new Date();
    } else {
      updateData.player2 = { connect: { id: next.player2Id } };
      if (current.isBye || current.player2Id === null) {
        updateData.isBye = false;
        updateData.status = 'pending';
        updateData.confirmedAt = null;
      }
    }
  }

  return updateData;
}

export async function updateRoundPairings(roundId: string, pairings: RoundPairingInput[]) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      matches: { select: { id: true, player1Id: true, player2Id: true, isBye: true } },
      event: { include: { season: true, config: true } },
    },
  });

  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }

  if (round.status !== 'not_started') {
    throw new AppError(409, 'INVALID_ROUND_STATE', 'Pairings can only be edited before the round starts');
  }

  if (round.event.config && isBracketFormat(round.event.config.format)) {
    throw new AppError(409, 'INVALID_OPERATION', 'Bracket pairings cannot be manually edited');
  }

  const matchById = new Map(round.matches.map((match) => [match.id, match]));
  const seenMatchIds = new Set<string>();

  for (const pairing of pairings) {
    if (pairing.matchId) {
      if (seenMatchIds.has(pairing.matchId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Duplicate match in pairings payload');
      }
      seenMatchIds.add(pairing.matchId);

      if (!matchById.has(pairing.matchId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Match does not belong to this round');
      }
    }

    if (pairing.player2Id !== null && pairing.player1Id === pairing.player2Id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Player 1 and player 2 must be different');
    }
  }

  const leagueId = round.event.season.leagueId;
  const memberships = await prisma.leagueMembership.findMany({
    where: { leagueId },
    select: { userId: true },
  });
  const memberIds = new Set(memberships.map((membership) => membership.userId));

  const playerCounts = new Map<string, number>();
  for (const pairing of pairings) {
    for (const playerId of [pairing.player1Id, pairing.player2Id]) {
      if (!playerId) {
        continue;
      }
      if (!memberIds.has(playerId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'All players must be league members');
      }
      playerCounts.set(playerId, (playerCounts.get(playerId) ?? 0) + 1);
    }
  }

  for (const [, count] of playerCounts) {
    if (count > 1) {
      throw new AppError(409, 'DUPLICATE_PLAYER', 'Player is paired in multiple matches this round');
    }
  }

  const isRoundRobin = round.event.config?.format === 'round_robin';
  const keptIds = new Set(pairings.map((pairing) => pairing.matchId).filter((id): id is string => Boolean(id)));
  const matchesToDelete = round.matches.filter((match) => !keptIds.has(match.id));
  const creates = pairings.filter((pairing) => !pairing.matchId);
  const updates = pairings
    .filter((pairing): pairing is RoundPairingInput & { matchId: string } => Boolean(pairing.matchId))
    .map((pairing) => {
      const current = matchById.get(pairing.matchId)!;
      const updateData = buildMatchPairingUpdateData(current, pairing);
      if (!updateData) {
        return null;
      }
      return {
        matchId: pairing.matchId,
        current,
        next: pairing,
        updateData,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  await prisma.$transaction(async (tx) => {
    for (const match of matchesToDelete) {
      if (isRoundRobin && match.player2Id) {
        await tx.scheduledPairing.updateMany({
          where: {
            roundId,
            OR: [
              { player1Id: match.player1Id, player2Id: match.player2Id },
              { player1Id: match.player2Id, player2Id: match.player1Id },
            ],
          },
          data: { roundId: null },
        });
      }

      await tx.gameResult.deleteMany({
        where: { matchId: match.id },
      });
      await tx.match.delete({
        where: { id: match.id },
      });
    }

    for (const pairing of creates) {
      const isBye = pairing.player2Id === null;
      await tx.match.create({
        data: {
          roundId,
          player1Id: pairing.player1Id,
          player2Id: pairing.player2Id,
          isBye,
          status: isBye ? 'confirmed' : 'pending',
          confirmedAt: isBye ? new Date() : null,
        },
      });
    }

    for (const update of updates) {
      await tx.match.update({
        where: { id: update.matchId },
        data: update.updateData,
      });

      const nextIsBye = update.next.player2Id === null;
      const shouldSyncScheduledPairing = isRoundRobin && !nextIsBye && update.next.player2Id !== null;
      if (shouldSyncScheduledPairing && update.current.player2Id) {
        await tx.scheduledPairing.updateMany({
          where: {
            roundId,
            OR: [
              { player1Id: update.current.player1Id, player2Id: update.current.player2Id },
              { player1Id: update.current.player2Id, player2Id: update.current.player1Id },
            ],
          },
          data: {
            player1Id: update.next.player1Id,
            player2Id: update.next.player2Id!,
          },
        });
      }
    }
  });
}

export function createMatchService() {
  return {
    validateMatchStateTransition,
    validateGameResults,
    reportMatch,
    confirmMatch,
    disputeMatch,
    resolveMatch,
    updateMatchPlayers,
    updateRoundPairings,
  };
}
