import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { recomputeStandings } from './standingsService.js';

const BRACKET_FORMATS = new Set(['single_elimination', 'double_elimination', 'custom_10_player']);
const SWISS_FORMATS = new Set(['swiss', 'seeded_swiss']);
const ROUND_ROBIN_FORMAT = 'round_robin';

type DropPlayerInput = {
  userId: string;
  seasonId: string;
  eventId?: string;
  reason?: string;
  droppedById: string;
};

function majorityWins(bestOfN: number | null | undefined) {
  const value = bestOfN ?? 3;
  return Math.ceil(value / 2);
}

function createAutoLossResults(winnerId: string, bestOfN: number | null | undefined) {
  const wins = majorityWins(bestOfN);
  return Array.from({ length: wins }, () => ({
    winnerId,
    isDraw: false,
  }));
}

function isBracketFormat(format: string | null | undefined) {
  return Boolean(format && BRACKET_FORMATS.has(format));
}

function isSwissFormat(format: string | null | undefined) {
  return Boolean(format && SWISS_FORMATS.has(format));
}

export async function dropPlayer(input: DropPlayerInput) {
  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: { id: true },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const seasonDrop = await prisma.playerDrop.findFirst({
    where: { userId: input.userId, seasonId: input.seasonId, eventId: null },
    select: { id: true },
  });
  if (seasonDrop) {
    throw new AppError(409, 'ALREADY_DROPPED', 'Player already dropped from this season');
  }

  let requestedEvent:
    | {
        id: string;
        seasonId: string;
        config: { format: string; bestOfN: number } | null;
      }
    | null = null;

  if (input.eventId) {
    requestedEvent = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        seasonId: true,
        config: {
          select: {
            format: true,
            bestOfN: true,
          },
        },
      },
    });
    if (!requestedEvent || requestedEvent.seasonId !== input.seasonId) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }
    if (isBracketFormat(requestedEvent.config?.format)) {
      throw new AppError(409, 'INVALID_OPERATION', 'Bracket events do not support player drops');
    }

    const eventDrop = await prisma.playerDrop.findFirst({
      where: { userId: input.userId, seasonId: input.seasonId, eventId: input.eventId },
      select: { id: true },
    });
    if (eventDrop) {
      throw new AppError(409, 'ALREADY_DROPPED', 'Player already dropped from this event');
    }
  }

  const allSeasonEvents = input.eventId
    ? [requestedEvent!]
    : await prisma.event.findMany({
        where: { seasonId: input.seasonId },
        select: {
          id: true,
          seasonId: true,
          config: {
            select: {
              format: true,
              bestOfN: true,
            },
          },
        },
      });

  const targetEvents = allSeasonEvents.filter((event) => !isBracketFormat(event.config?.format));

  const affectedMatches = await prisma.$transaction(async (tx) => {
    await tx.playerDrop.create({
      data: {
        userId: input.userId,
        seasonId: input.seasonId,
        eventId: input.eventId ?? null,
        reason: input.reason?.trim() || null,
        droppedById: input.droppedById,
      },
    });

    let affected = 0;
    for (const event of targetEvents) {
      const pendingMatches = await tx.match.findMany({
        where: {
          status: 'pending',
          OR: [{ player1Id: input.userId }, { player2Id: input.userId }],
          round: {
            eventId: event.id,
            status: { in: ['not_started', 'in_progress'] },
          },
        },
        select: {
          id: true,
          player1Id: true,
          player2Id: true,
          isBye: true,
          round: {
            select: {
              event: {
                select: {
                  config: {
                    select: {
                      format: true,
                      bestOfN: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const match of pendingMatches) {
        const format = match.round.event.config?.format ?? null;
        if (isSwissFormat(format)) {
          if (match.player1Id === input.userId && match.player2Id === null) {
            await tx.match.delete({ where: { id: match.id } });
            affected += 1;
            continue;
          }

          if (match.player1Id === input.userId && match.player2Id) {
            await tx.match.update({
              where: { id: match.id },
              data: {
                player1: { connect: { id: match.player2Id } },
                player2: { disconnect: true },
                isBye: true,
                status: 'confirmed',
                confirmedAt: new Date(),
                reportedBy: { disconnect: true },
              },
            });
            affected += 1;
            continue;
          }

          if (match.player2Id === input.userId) {
            await tx.match.update({
              where: { id: match.id },
              data: {
                player2: { disconnect: true },
                isBye: true,
                status: 'confirmed',
                confirmedAt: new Date(),
                reportedBy: { disconnect: true },
              },
            });
            affected += 1;
            continue;
          }
        }

        if (format === ROUND_ROBIN_FORMAT && match.player2Id) {
          const winnerId = match.player1Id === input.userId ? match.player2Id : match.player1Id;
          const gameResults = createAutoLossResults(winnerId, match.round.event.config?.bestOfN);

          await tx.match.update({
            where: { id: match.id },
            data: {
              status: 'confirmed',
              confirmedAt: new Date(),
              isBye: false,
              reportedBy: { connect: { id: input.droppedById } },
            },
          });

          await tx.gameResult.deleteMany({ where: { matchId: match.id } });
          await tx.gameResult.createMany({
            data: gameResults.map((result, index) => ({
              matchId: match.id,
              gameNumber: index + 1,
              winnerId: result.winnerId,
              isDraw: result.isDraw,
            })),
          });
          affected += 1;
        }
      }
    }

    return affected;
  });

  await recomputeStandings(input.seasonId);

  return {
    droppedFrom: input.eventId ? 'event' : 'season',
    affectedMatches,
  } as const;
}
