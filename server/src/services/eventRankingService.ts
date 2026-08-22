import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';

type EventResultUser = {
  id: string;
  displayName: string;
  publicName: string | null;
  discordHandle: string | null;
  slug: string;
  avatarUrl: string | null;
};

type EventResultStat = {
  userId: string;
  matchPoints: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  opponents: string[];
};

function floorWinPercent(value: number) {
  return Math.max(0.33, Number.isFinite(value) ? value : 0);
}

function compareResults(a: EventResultStat & { omwPercent: number; gwPercent: number; ogwPercent: number }, b: EventResultStat & { omwPercent: number; gwPercent: number; ogwPercent: number }) {
  if (b.matchPoints !== a.matchPoints) {
    return b.matchPoints - a.matchPoints;
  }
  if (b.omwPercent !== a.omwPercent) {
    return b.omwPercent - a.omwPercent;
  }
  if (b.gwPercent !== a.gwPercent) {
    return b.gwPercent - a.gwPercent;
  }
  if (b.ogwPercent !== a.ogwPercent) {
    return b.ogwPercent - a.ogwPercent;
  }
  return a.userId.localeCompare(b.userId);
}

export async function getEventResults(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      rounds: {
        include: {
          matches: {
            where: { status: { in: ['confirmed', 'resolved'] } },
            include: { gameResults: true },
          },
        },
      },
      season: {
        include: {
          league: {
            include: {
              memberships: {
                include: {
                  user: {
                    select: USER_PUBLIC_SELECT,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  if (event.status !== 'completed') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Event must be completed before viewing final results');
  }

  const members = event.season.league.memberships.map((membership) => membership.user);
  const usersById = new Map<string, EventResultUser>(members.map((user) => [user.id, user]));
  const stats = new Map<string, EventResultStat>(
    members.map((user) => [
      user.id,
      {
        userId: user.id,
        matchPoints: 0,
        matchWins: 0,
        matchLosses: 0,
        matchDraws: 0,
        gameWins: 0,
        gameLosses: 0,
        opponents: [],
      },
    ]),
  );

  for (const round of event.rounds) {
    for (const match of round.matches) {
      const p1 = stats.get(match.player1Id);
      if (!p1) {
        continue;
      }

      const p2 = match.player2Id ? stats.get(match.player2Id) : null;
      let p1GameWins = 0;
      let p2GameWins = 0;
      for (const game of match.gameResults) {
        if (!game.winnerId || game.isDraw) {
          continue;
        }
        if (game.winnerId === match.player1Id) {
          p1GameWins += 1;
        } else if (match.player2Id && game.winnerId === match.player2Id) {
          p2GameWins += 1;
        }
      }

      p1.gameWins += p1GameWins;
      p1.gameLosses += p2GameWins;

      if (p2 && match.player2Id) {
        p2.gameWins += p2GameWins;
        p2.gameLosses += p1GameWins;
        p1.opponents.push(match.player2Id);
        p2.opponents.push(match.player1Id);
      }

      if (match.isBye || !p2) {
        p1.matchWins += 1;
        p1.matchPoints += 3;
        if (p1GameWins === 0) {
          p1.gameWins += 2;
        }
        continue;
      }

      if (p1GameWins > p2GameWins) {
        p1.matchWins += 1;
        p2.matchLosses += 1;
        p1.matchPoints += 3;
      } else if (p2GameWins > p1GameWins) {
        p2.matchWins += 1;
        p1.matchLosses += 1;
        p2.matchPoints += 3;
      } else {
        p1.matchDraws += 1;
        p2.matchDraws += 1;
        p1.matchPoints += 1;
        p2.matchPoints += 1;
      }
    }
  }

  const statEntries = Array.from(stats.values());
  const matchWinPercentByUser = new Map<string, number>();
  const gameWinPercentByUser = new Map<string, number>();

  for (const stat of statEntries) {
    const totalMatches = stat.matchWins + stat.matchLosses + stat.matchDraws;
    const totalGames = stat.gameWins + stat.gameLosses;
    const matchWinPercent = totalMatches === 0 ? 0 : (stat.matchWins * 3 + stat.matchDraws) / (totalMatches * 3);
    const gameWinPercent = totalGames === 0 ? 0 : stat.gameWins / totalGames;
    matchWinPercentByUser.set(stat.userId, floorWinPercent(matchWinPercent));
    gameWinPercentByUser.set(stat.userId, floorWinPercent(gameWinPercent));
  }

  const withTiebreakers = statEntries.map((stat) => {
    const totalGames = stat.gameWins + stat.gameLosses;
    const gwPercent = totalGames === 0 ? 0 : stat.gameWins / totalGames;
    const oppMatchPercents =
      stat.opponents.length === 0
        ? [0.33]
        : stat.opponents.map((opponentId) => matchWinPercentByUser.get(opponentId) ?? 0.33);
    const oppGamePercents =
      stat.opponents.length === 0 ? [0.33] : stat.opponents.map((opponentId) => gameWinPercentByUser.get(opponentId) ?? 0.33);
    const omwPercent = oppMatchPercents.reduce((sum, value) => sum + floorWinPercent(value), 0) / oppMatchPercents.length;
    const ogwPercent = oppGamePercents.reduce((sum, value) => sum + floorWinPercent(value), 0) / oppGamePercents.length;

    return {
      ...stat,
      gwPercent: floorWinPercent(gwPercent),
      omwPercent: floorWinPercent(omwPercent),
      ogwPercent: floorWinPercent(ogwPercent),
    };
  });

  withTiebreakers.sort(compareResults);

  return withTiebreakers
    .map((standing, index) => {
      const user = usersById.get(standing.userId);
      if (!user) {
        return null;
      }
      return {
        rank: index + 1,
        userId: standing.userId,
        user,
        matchPoints: standing.matchPoints,
        matchWins: standing.matchWins,
        matchLosses: standing.matchLosses,
        matchDraws: standing.matchDraws,
        gameWins: standing.gameWins,
        gameLosses: standing.gameLosses,
        omwPercent: standing.omwPercent,
        gwPercent: standing.gwPercent,
        ogwPercent: standing.ogwPercent,
      };
    })
    .filter((standing): standing is NonNullable<typeof standing> => Boolean(standing));
}
