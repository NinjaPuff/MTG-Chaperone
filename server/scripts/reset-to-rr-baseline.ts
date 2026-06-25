/**
 * Dev helper: reset season progress while keeping round-robin events and card pools.
 *
 * Usage (from repo root):
 *   DATABASE_URL=postgresql://user:password@localhost:5433/mtgleague npx tsx server/scripts/reset-to-rr-baseline.ts
 */
import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';
import { recomputeStandings } from '../src/services/standingsService.js';

async function main() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { number: 'asc' },
    include: {
      events: {
        orderBy: { orderIndex: 'asc' },
        include: {
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: {
              matches: {
                select: { id: true, isBye: true },
              },
            },
          },
        },
      },
      league: {
        include: {
          memberships: { select: { userId: true } },
        },
      },
    },
  });

  if (!season) {
    console.error('No active season found.');
    process.exit(1);
  }

  const memberCount = season.league.memberships.length;
  const poolCount = await prisma.cardPool.count({ where: { seasonId: season.id } });

  console.log(`Resetting season "${season.name}" (${memberCount} members, ${poolCount} card pools)...`);

  const roundIds = season.events.flatMap((event) => event.rounds.map((round) => round.id));
  const matchIds = season.events.flatMap((event) =>
    event.rounds.flatMap((round) => round.matches.map((match) => match.id)),
  );

  await prisma.$transaction(async (tx) => {
    await tx.decklistEntry.deleteMany({
      where: {
        decklist: {
          event: { seasonId: season.id },
        },
      },
    });
    await tx.decklist.deleteMany({
      where: {
        event: { seasonId: season.id },
      },
    });

    await tx.gameResult.deleteMany({
      where: {
        matchId: { in: matchIds },
      },
    });

    await tx.match.updateMany({
      where: {
        id: { in: matchIds },
        isBye: true,
      },
      data: {
        status: 'confirmed',
        reportedById: null,
        confirmedAt: new Date(),
      },
    });
    await tx.match.updateMany({
      where: {
        id: { in: matchIds },
        isBye: false,
      },
      data: {
        status: 'pending',
        reportedById: null,
        confirmedAt: null,
      },
    });

    await tx.round.updateMany({
      where: { id: { in: roundIds } },
      data: { status: 'not_started' },
    });

    for (const event of season.events) {
      const totalRounds = event.rounds.length > 0 ? event.rounds.length : event.totalRounds ?? 3;
      await tx.event.update({
        where: { id: event.id },
        data: {
          status: 'setup',
          totalRounds,
        },
      });
    }

    await tx.scheduledPairing.updateMany({
      where: {
        schedule: { seasonId: season.id },
      },
      data: {
        roundId: null,
        eventId: null,
      },
    });

    await tx.standing.updateMany({
      where: { seasonId: season.id },
      data: {
        points: 0,
        matchWins: 0,
        matchLosses: 0,
        matchDraws: 0,
        gameWins: 0,
        gameLosses: 0,
        omwPercent: 0,
        gwPercent: 0,
        ogwPercent: 0,
      },
    });
  });

  await recomputeStandings(season.id);

  const summary = await prisma.season.findUnique({
    where: { id: season.id },
    include: {
      events: {
        orderBy: { orderIndex: 'asc' },
        include: {
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: { _count: { select: { matches: true, decklists: true } } },
          },
          _count: { select: { decklists: true } },
        },
      },
      cardPools: {
        include: {
          user: { select: { slug: true } },
          boosterProduct: { select: { name: true } },
        },
      },
      standings: {
        include: { user: { select: { slug: true } } },
        orderBy: { points: 'desc' },
      },
    },
  });

  console.log('Reset complete.');
  console.log(
    JSON.stringify(
      {
        events: summary?.events.map((event) => ({
          name: event.name,
          status: event.status,
          totalRounds: event.totalRounds,
          rounds: event.rounds.map((round) => ({
            roundNumber: round.roundNumber,
            status: round.status,
            matches: round._count.matches,
            decklists: round._count.decklists,
          })),
          decklists: event._count.decklists,
        })),
        cardPools: summary?.cardPools.map((pool) => ({
          user: pool.user.slug,
          product: pool.boosterProduct.name,
        })),
        standings: summary?.standings.map((standing) => ({
          user: standing.user.slug,
          points: standing.points,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
