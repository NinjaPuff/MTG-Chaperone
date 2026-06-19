/**
 * Dev helper: completes pending round-robin events with match results.
 * Scott (ninjapuff) wins every match he plays so he finishes in the top 2 seeds.
 *
 * Usage (from repo root):
 *   npx tsx server/scripts/complete-round-robin-events.ts [eventOrderIndexes...]
 *   npx tsx server/scripts/complete-round-robin-events.ts 2 3
 */
import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';
import { startEvent } from '../src/services/eventService.js';
import { startRound } from '../src/services/roundService.js';
import { reportMatch, resolveMatch } from '../src/services/matchService.js';
import { getStandings, recomputeStandings } from '../src/services/standingsService.js';

const SCOTT_SLUG = 'ninjapuff';

function buildWinningGames(winnerId: string, loserId: string) {
  return [{ winnerId }, { winnerId }];
}

function pickWinner(player1Id: string, player2Id: string | null, scottId: string) {
  if (!player2Id) {
    return player1Id;
  }
  if (player1Id === scottId) {
    return scottId;
  }
  if (player2Id === scottId) {
    return scottId;
  }
  return player1Id < player2Id ? player1Id : player2Id;
}

async function resolveMatchAsAdmin(
  matchId: string,
  adminId: string,
  winnerId: string,
  loserId: string | null,
) {
  const gameResults =
    loserId == null
      ? [{ winnerId }]
      : buildWinningGames(winnerId, loserId);

  await reportMatch(matchId, adminId, gameResults);
  await resolveMatch(matchId, adminId, gameResults);
}

async function completeEvent(eventId: string, adminId: string, scottId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          matches: {
            include: {
              player1: { select: { displayName: true } },
              player2: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  if (event.status === 'setup') {
    await startEvent(eventId);
    console.log(`Started event: ${event.name}`);
  } else if (event.status === 'completed') {
    console.log(`Skipping already completed event: ${event.name}`);
    return;
  } else {
    console.log(`Continuing active event: ${event.name}`);
  }

  for (const round of event.rounds) {
    if (round.status === 'not_started') {
      await startRound(round.id);
      console.log(`  Started round ${round.roundNumber}`);
    }

    for (const match of round.matches) {
      if (['confirmed', 'resolved'].includes(match.status)) {
        continue;
      }

      const winnerId = pickWinner(match.player1Id, match.player2Id, scottId);
      const loserId =
        match.player2Id && winnerId === match.player1Id
          ? match.player2Id
          : match.player2Id && winnerId === match.player2Id
            ? match.player1Id
            : null;

      await resolveMatchAsAdmin(match.id, adminId, winnerId, loserId);

      const winnerName =
        winnerId === match.player1Id ? match.player1.displayName : match.player2?.displayName ?? 'BYE';
      const loserName =
        loserId === match.player1Id ? match.player1.displayName : match.player2?.displayName ?? 'BYE';
      console.log(`    ${winnerName} def. ${loserName}`);
    }
  }

  const refreshed = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, status: true },
  });
  console.log(`  Event status: ${refreshed?.status}`);
}

async function main() {
  const orderIndexes = process.argv.slice(2).map((value) => Number.parseInt(value, 10));
  const targets = orderIndexes.length > 0 ? orderIndexes : [2, 3];

  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true, displayName: true, slug: true },
  });
  if (!admin) {
    throw new Error('No admin user found');
  }

  const scott = await prisma.user.findUnique({
    where: { slug: SCOTT_SLUG },
    select: { id: true, displayName: true, publicName: true },
  });
  if (!scott) {
    throw new Error(`User not found: ${SCOTT_SLUG}`);
  }

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!season) {
    throw new Error('No active season found');
  }

  console.log(`Admin: ${admin.displayName}`);
  console.log(`Scott: ${scott.publicName ?? scott.displayName} (${scott.id})`);
  console.log(`Season: ${season.name}\n`);

  for (const orderIndex of targets) {
    const event = await prisma.event.findFirst({
      where: { seasonId: season.id, orderIndex },
      select: { id: true, name: true, status: true },
    });
    if (!event) {
      console.warn(`No event at order index ${orderIndex}`);
      continue;
    }

    console.log(`=== Event ${orderIndex}: ${event.name} ===`);
    await completeEvent(event.id, admin.id, scott.id);
    await recomputeStandings(season.id);
    console.log('');
  }

  const standings = await getStandings(season.id);
  console.log('Final season standings:');
  standings.forEach((standing, index) => {
    const label = standing.user.publicName ?? standing.user.displayName;
    console.log(
      `  ${index + 1}. ${label} — ${standing.points} pts (${standing.matchWins}-${standing.matchLosses}-${standing.matchDraws})`,
    );
  });

  const scottRank = standings.findIndex((standing) => standing.userId === scott.id) + 1;
  if (scottRank <= 2) {
    console.log(`\nScott is seed #${scottRank}.`);
  } else {
    console.error(`\nScott is seed #${scottRank}, expected top 2.`);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
