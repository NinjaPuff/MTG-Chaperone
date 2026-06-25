/**
 * Dev helper: adds test players to the first league for bracket testing.
 *
 * Usage (from repo root):
 *   npx tsx server/scripts/add-bracket-players.ts [count]
 */
import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';

const DEFAULT_COUNT = 2;

const TEST_PLAYERS = [
  { displayName: 'Bracket Player Nine', slug: 'bracket-player-9', discordId: '000000000000000009' },
  { displayName: 'Bracket Player Ten', slug: 'bracket-player-10', discordId: '000000000000000010' },
  { displayName: 'Bracket Player Eleven', slug: 'bracket-player-11', discordId: '000000000000000011' },
  { displayName: 'Bracket Player Twelve', slug: 'bracket-player-12', discordId: '000000000000000012' },
];

async function main() {
  const countArg = process.argv[2]?.trim();
  const count = countArg ? Number.parseInt(countArg, 10) : DEFAULT_COUNT;
  if (!Number.isFinite(count) || count < 1) {
    console.error('Usage: npx tsx server/scripts/add-bracket-players.ts [count]');
    process.exit(1);
  }

  const league = await prisma.league.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      memberships: { include: { user: { select: { slug: true, displayName: true } } } },
    },
  });

  if (!league) {
    console.error('No league found. Create a league in Admin first.');
    process.exit(1);
  }

  console.log(`League: ${league.name}`);
  console.log(`Current members (${league.memberships.length}):`);
  league.memberships.forEach((membership, index) => {
    console.log(`  ${index + 1}. ${membership.user.displayName} (${membership.user.slug})`);
  });

  const existingSlugs = new Set(league.memberships.map((membership) => membership.user.slug));
  const toAdd = TEST_PLAYERS.filter((player) => !existingSlugs.has(player.slug)).slice(0, count);

  if (toAdd.length === 0) {
    console.log('\nNo new test players to add (all fixture players already exist in this league).');
    return;
  }

  if (toAdd.length < count) {
    console.warn(`\nOnly ${toAdd.length} fixture player(s) available; requested ${count}.`);
  }

  for (const player of toAdd) {
    const user = await prisma.user.upsert({
      where: { slug: player.slug },
      create: {
        displayName: player.displayName,
        slug: player.slug,
        discordId: player.discordId,
        role: 'user',
      },
      update: {
        displayName: player.displayName,
      },
    });

    await prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
      create: { userId: user.id, leagueId: league.id },
      update: {},
    });

    console.log(`Added: ${user.displayName} (${user.slug})`);
  }

  const finalCount = await prisma.leagueMembership.count({ where: { leagueId: league.id } });
  console.log(`\nDone. League now has ${finalCount} members.`);
  if (finalCount === 10) {
    console.log('Ready for custom 10-player bracket (exactly 10 league members).');
  } else if (finalCount < 10) {
    console.log(`Need ${10 - finalCount} more member(s) for custom 10-player bracket.`);
  } else {
    console.log(`Custom 10-player bracket requires exactly 10 members (currently ${finalCount}).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
