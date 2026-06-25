import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { formatProfileResponse } from '../lib/userProfileRules.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';
import { canViewPool, canViewSeasonDecklists } from '../lib/visibilityRules.js';

type StandingRow = {
  seasonId: string;
  userId: string;
  points: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  omwPercent: number;
  gwPercent: number;
  ogwPercent: number;
  season: {
    id: string;
    number: number;
    name: string;
    isActive: boolean;
  };
};

export function computeWinRate(matchWins: number, matchLosses: number, matchDraws: number) {
  const total = matchWins + matchLosses + matchDraws;
  if (total === 0) {
    return 0;
  }
  return matchWins / total;
}

export function computeCareerStats(standings: Array<{
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
}>) {
  const totals = standings.reduce(
    (acc, standing) => ({
      matchWins: acc.matchWins + standing.matchWins,
      matchLosses: acc.matchLosses + standing.matchLosses,
      matchDraws: acc.matchDraws + standing.matchDraws,
    }),
    { matchWins: 0, matchLosses: 0, matchDraws: 0 },
  );

  const totalMatches = totals.matchWins + totals.matchLosses + totals.matchDraws;
  return {
    seasonsPlayed: standings.length,
    totalMatches,
    matchWins: totals.matchWins,
    matchLosses: totals.matchLosses,
    matchDraws: totals.matchDraws,
    winRate: computeWinRate(totals.matchWins, totals.matchLosses, totals.matchDraws),
  };
}

export function buildSeasonHistory(
  standings: StandingRow[],
  rankBySeasonId: Map<string, number>,
) {
  return [...standings]
    .sort((a, b) => b.season.number - a.season.number)
    .map((standing) => ({
      seasonId: standing.seasonId,
      number: standing.season.number,
      name: standing.season.name,
      isActive: standing.season.isActive,
      rank: rankBySeasonId.get(standing.seasonId) ?? null,
      points: standing.points,
      matchWins: standing.matchWins,
      matchLosses: standing.matchLosses,
      matchDraws: standing.matchDraws,
    }));
}

export function formatMatchScore(
  viewerId: string,
  match: {
    isBye: boolean;
    player1Id: string;
    player2Id: string | null;
    gameResults: Array<{ winnerId: string | null; isDraw: boolean }>;
  },
) {
  if (match.isBye) {
    return '2-0';
  }

  let viewerWins = 0;
  let opponentWins = 0;
  for (const game of match.gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === viewerId) {
      viewerWins += 1;
    } else {
      opponentWins += 1;
    }
  }

  return `${viewerWins}-${opponentWins}`;
}

export function resolveMatchResult(
  viewerId: string,
  match: {
    isBye: boolean;
    player1Id: string;
    player2Id: string | null;
    gameResults: Array<{ winnerId: string | null; isDraw: boolean }>;
  },
): 'win' | 'loss' | 'draw' {
  if (match.isBye) {
    return 'win';
  }

  let viewerWins = 0;
  let opponentWins = 0;
  for (const game of match.gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === viewerId) {
      viewerWins += 1;
    } else {
      opponentWins += 1;
    }
  }

  if (viewerWins === opponentWins) {
    return 'draw';
  }
  return viewerWins > opponentWins ? 'win' : 'loss';
}

export async function getPublicProfile(slug: string, viewerId?: string | null) {
  const user = await prisma.user.findUnique({
    where: { slug },
    select: {
      ...USER_PUBLIC_SELECT,
      discordId: true,
      googleId: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const isSelf = viewerId === user.id;

  const league = await prisma.league.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, slug: true, name: true },
  });

  const activeSeason = league
    ? await prisma.season.findFirst({
        where: { leagueId: league.id, isActive: true },
        select: {
          id: true,
          number: true,
          name: true,
          poolVisibility: true,
          decklistVisibility: true,
          scheduleVisibility: true,
        },
      })
    : null;

  const standings = await prisma.standing.findMany({
    where: {
      userId: user.id,
      ...(league ? { season: { leagueId: league.id } } : {}),
    },
    include: {
      season: {
        select: {
          id: true,
          number: true,
          name: true,
          isActive: true,
        },
      },
    },
    orderBy: { season: { number: 'desc' } },
  });

  const rankBySeasonId = new Map<string, number>();
  const seasonIds = [...new Set(standings.map((standing) => standing.seasonId))];
  for (const seasonId of seasonIds) {
    const seasonStandings = await prisma.standing.findMany({
      where: { seasonId },
      orderBy: [
        { points: 'desc' },
        { omwPercent: 'desc' },
        { gwPercent: 'desc' },
        { ogwPercent: 'desc' },
      ],
      select: { userId: true },
    });
    seasonStandings.forEach((row, index) => {
      if (row.userId === user.id) {
        rankBySeasonId.set(seasonId, index + 1);
      }
    });
  }

  const currentStandingRow = activeSeason
    ? standings.find((standing) => standing.seasonId === activeSeason.id) ?? null
    : null;

  const pool = activeSeason
    ? await prisma.cardPool.findUnique({
        where: {
          userId_seasonId: {
            userId: user.id,
            seasonId: activeSeason.id,
          },
        },
        select: { id: true },
      })
    : null;

  const viewer = viewerId
    ? await prisma.user.findUnique({
        where: { id: viewerId },
        select: { id: true, role: true },
      })
    : null;

  const poolVisible = activeSeason
    ? pool
      ? canViewPool({ userId: user.id }, activeSeason, viewer)
      : false
    : false;

  const decklistsVisible = activeSeason
    ? canViewSeasonDecklists(activeSeason, viewer, user.id)
    : false;

  const formattedUser = formatProfileResponse(user);
  const { authProvider, ...publicUser } = formattedUser;

  return {
    user: isSelf ? formattedUser : publicUser,
    league,
    activeSeason,
    currentStanding: currentStandingRow
      ? {
          rank: rankBySeasonId.get(currentStandingRow.seasonId) ?? null,
          points: currentStandingRow.points,
          matchWins: currentStandingRow.matchWins,
          matchLosses: currentStandingRow.matchLosses,
          matchDraws: currentStandingRow.matchDraws,
          omwPercent: currentStandingRow.omwPercent,
          gwPercent: currentStandingRow.gwPercent,
          ogwPercent: currentStandingRow.ogwPercent,
        }
      : null,
    career: computeCareerStats(standings),
    seasonHistory: buildSeasonHistory(standings, rankBySeasonId),
    links: {
      poolId: pool?.id ?? null,
      poolVisible,
      decklistsVisible,
    },
  };
}

export async function getUserMatchHistory(
  slug: string,
  options: { seasonId?: string; page?: number; limit?: number },
) {
  const user = await prisma.user.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.MatchWhereInput = {
    status: { in: ['confirmed', 'resolved'] },
    OR: [{ player1Id: user.id }, { player2Id: user.id }],
    ...(options.seasonId
      ? {
          round: {
            event: {
              seasonId: options.seasonId,
            },
          },
        }
      : {}),
  };

  const [total, matches] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      include: {
        player1: { select: USER_PUBLIC_SELECT },
        player2: { select: USER_PUBLIC_SELECT },
        gameResults: true,
        round: {
          include: {
            event: {
              include: {
                season: {
                  select: {
                    id: true,
                    number: true,
                    name: true,
                    league: {
                      select: {
                        slug: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  const data = matches.map((match) => {
    const isPlayer1 = match.player1Id === user.id;
    const opponent = isPlayer1 ? match.player2 : match.player1;
    return {
      matchId: match.id,
      league: {
        slug: match.round.event.season.league.slug,
        name: match.round.event.season.league.name,
      },
      season: {
        id: match.round.event.season.id,
        number: match.round.event.season.number,
        name: match.round.event.season.name,
      },
      event: {
        id: match.round.event.id,
        name: match.round.event.name,
      },
      round: match.round.roundNumber,
      opponent: opponent
        ? {
            slug: opponent.slug,
            displayName: opponent.displayName,
            publicName: opponent.publicName,
          }
        : null,
      result: resolveMatchResult(user.id, match),
      score: formatMatchScore(user.id, match),
      date: (match.confirmedAt ?? match.createdAt).toISOString(),
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}