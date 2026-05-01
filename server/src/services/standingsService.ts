import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type Stat = {
  userId: string;
  points: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  opponents: string[];
};

const floorWinPercent = (value: number) => Math.max(0.33, Number.isFinite(value) ? value : 0);

export async function recomputeStandings(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      pointConfig: true,
      league: {
        include: {
          memberships: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!season || !season.pointConfig) {
    throw new AppError(404, 'NOT_FOUND', 'Season or point config not found');
  }

  const overrideEvent = await prisma.event.findFirst({
    where: {
      seasonId,
      standingsOverride: true,
      status: 'completed',
    },
    orderBy: { orderIndex: 'desc' },
    select: { id: true },
  });

  const matches = await prisma.match.findMany({
    where: {
      round: {
        event: {
          seasonId,
          ...(overrideEvent ? { id: overrideEvent.id } : {}),
        },
      },
      status: { in: ['confirmed', 'resolved'] },
    },
    include: {
      gameResults: true,
      round: {
        include: { event: true },
      },
    },
  });

  const stats = new Map<string, Stat>();
  for (const membership of season.league.memberships) {
    stats.set(membership.userId, {
      userId: membership.userId,
      points: 0,
      matchWins: 0,
      matchLosses: 0,
      matchDraws: 0,
      gameWins: 0,
      gameLosses: 0,
      opponents: [],
    });
  }

  for (const match of matches) {
    const p1 = stats.get(match.player1Id);
    const p2 = match.player2Id ? stats.get(match.player2Id) : undefined;
    if (!p1) {
      continue;
    }

    let p1GamesWon = 0;
    let p2GamesWon = 0;
    for (const game of match.gameResults) {
      if (!game.winnerId || game.isDraw) {
        continue;
      }
      if (game.winnerId === match.player1Id) {
        p1GamesWon += 1;
      }
      if (match.player2Id && game.winnerId === match.player2Id) {
        p2GamesWon += 1;
      }
    }

    p1.gameWins += p1GamesWon;
    p1.gameLosses += p2GamesWon;

    if (p2) {
      p2.gameWins += p2GamesWon;
      p2.gameLosses += p1GamesWon;
      p1.opponents.push(p2.userId);
      p2.opponents.push(p1.userId);
    }

    const pointMultiplier = match.round.event.pointMultiplier;
    if (match.isBye || !p2) {
      p1.matchWins += 1;
      p1.points += season.pointConfig.matchWinPoints * pointMultiplier;
      continue;
    }

    if (p1GamesWon > p2GamesWon) {
      p1.matchWins += 1;
      p2.matchLosses += 1;
      p1.points += season.pointConfig.matchWinPoints * pointMultiplier;
      p2.points += season.pointConfig.matchLossPoints * pointMultiplier;
    } else if (p2GamesWon > p1GamesWon) {
      p2.matchWins += 1;
      p1.matchLosses += 1;
      p2.points += season.pointConfig.matchWinPoints * pointMultiplier;
      p1.points += season.pointConfig.matchLossPoints * pointMultiplier;
    } else {
      p1.matchDraws += 1;
      p2.matchDraws += 1;
      p1.points += season.pointConfig.matchDrawPoints * pointMultiplier;
      p2.points += season.pointConfig.matchDrawPoints * pointMultiplier;
    }
  }

  const statEntries = Array.from(stats.values());
  const matchWinPercentByUser = new Map<string, number>();
  const gwPercentByUser = new Map<string, number>();

  for (const stat of statEntries) {
    const totalMatches = stat.matchWins + stat.matchLosses + stat.matchDraws;
    const totalGames = stat.gameWins + stat.gameLosses;
    const matchWinPercent = totalMatches === 0 ? 0 : (stat.matchWins + stat.matchDraws * 0.5) / totalMatches;
    const gameWinPercent = totalGames === 0 ? 0 : stat.gameWins / totalGames;
    matchWinPercentByUser.set(stat.userId, floorWinPercent(matchWinPercent));
    gwPercentByUser.set(stat.userId, floorWinPercent(gameWinPercent));
  }

  await prisma.standing.deleteMany({ where: { seasonId } });

  await prisma.standing.createMany({
    data: statEntries.map((stat) => {
      const totalGames = stat.gameWins + stat.gameLosses;
      const gwPercent = totalGames === 0 ? 0 : stat.gameWins / totalGames;
      const oppMatchPercents =
        stat.opponents.length === 0
          ? [0.33]
          : stat.opponents.map((opponentId) => matchWinPercentByUser.get(opponentId) ?? 0.33);
      const oppGamePercents =
        stat.opponents.length === 0
          ? [0.33]
          : stat.opponents.map((opponentId) => gwPercentByUser.get(opponentId) ?? 0.33);

      const omwPercent =
        oppMatchPercents.reduce((sum, value) => sum + floorWinPercent(value), 0) / oppMatchPercents.length;
      const ogwPercent =
        oppGamePercents.reduce((sum, value) => sum + floorWinPercent(value), 0) / oppGamePercents.length;

      return {
        seasonId,
        userId: stat.userId,
        points: Math.round(stat.points),
        matchWins: stat.matchWins,
        matchLosses: stat.matchLosses,
        matchDraws: stat.matchDraws,
        gameWins: stat.gameWins,
        gameLosses: stat.gameLosses,
        gwPercent: floorWinPercent(gwPercent),
        omwPercent: floorWinPercent(omwPercent),
        ogwPercent: floorWinPercent(ogwPercent),
      };
    }),
  });
}

export async function getStandings(seasonId: string) {
  return prisma.standing.findMany({
    where: { seasonId },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          publicName: true,
          slug: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [{ points: 'desc' }, { omwPercent: 'desc' }, { gwPercent: 'desc' }, { ogwPercent: 'desc' }],
  });
}
