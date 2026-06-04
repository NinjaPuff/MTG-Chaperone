/**
 * Dev helper: creates Demo Player (with pool) and optionally assigns a pool to your account.
 *
 * Usage (from repo root):
 *   npx tsx server/scripts/seed-card-pools-demo.ts
 *   npx tsx server/scripts/seed-card-pools-demo.ts your-user-slug
 */
import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';
import { createPool } from '../src/services/cardPoolService.js';

const DEMO_SLUG = 'demo-player';
const DEMO_DISCORD_ID = '000000000000000001';

async function main() {
  const targetSlug = process.argv[2]?.trim() || null;

  const league = await prisma.league.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      seasons: { where: { isActive: true }, take: 1 },
      memberships: { include: { user: { select: { id: true, slug: true, displayName: true } } } },
    },
  });

  if (!league) {
    console.error('No league found. Create a league in Admin first.');
    process.exit(1);
  }

  const season = league.seasons[0];
  if (!season) {
    console.error('No active season. Create or activate a season in Admin first.');
    process.exit(1);
  }

  const boosterProduct = await prisma.boosterProduct.findFirst({
    orderBy: { name: 'asc' },
    include: { setCodes: true },
  });

  if (!boosterProduct) {
    console.error('No booster product found. Create one in Admin → Booster Products first.');
    process.exit(1);
  }

  const altProduct =
    (await prisma.boosterProduct.findFirst({
      where: { id: { not: boosterProduct.id } },
      orderBy: { name: 'asc' },
    })) ?? boosterProduct;

  let demoUser = await prisma.user.findUnique({ where: { slug: DEMO_SLUG } });
  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        displayName: 'Demo Player',
        slug: DEMO_SLUG,
        discordId: DEMO_DISCORD_ID,
        role: 'user',
      },
    });
    console.log(`Created user: ${demoUser.displayName} (${demoUser.slug})`);
  } else {
    console.log(`Using existing user: ${demoUser.displayName} (${demoUser.slug})`);
  }

  const demoMembership = await prisma.leagueMembership.upsert({
    where: { userId_leagueId: { userId: demoUser.id, leagueId: league.id } },
    create: { userId: demoUser.id, leagueId: league.id },
    update: {},
  });

  const demoPoolExisting = await prisma.cardPool.findUnique({
    where: { userId_seasonId: { userId: demoUser.id, seasonId: season.id } },
  });

  if (!demoPoolExisting) {
    await createPool(demoUser.id, season.id, altProduct.id);
    console.log(`Assigned pool to Demo Player: ${altProduct.name}`);
  } else {
    console.log('Demo Player already has a pool for this season.');
  }

  let targetUser =
    targetSlug != null
      ? await prisma.user.findUnique({ where: { slug: targetSlug } })
      : league.memberships
          .map((m) => m.user)
          .find((u) => u.slug !== DEMO_SLUG && !u.slug.startsWith('demo-'));

  if (targetSlug && !targetUser) {
    console.error(`No user with slug "${targetSlug}". Log in once via Discord to create your account, then re-run with your slug.`);
    process.exit(1);
  }

  if (targetUser) {
    await prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: targetUser.id, leagueId: league.id } },
      create: { userId: targetUser.id, leagueId: league.id },
      update: {},
    });

    const yourPool = await prisma.cardPool.findUnique({
      where: { userId_seasonId: { userId: targetUser.id, seasonId: season.id } },
    });

    if (!yourPool) {
      await createPool(targetUser.id, season.id, boosterProduct.id);
      console.log(`Assigned pool to you (${targetUser.displayName}): ${boosterProduct.name}`);
    } else {
      console.log(`${targetUser.displayName} already has a pool for this season.`);
    }
  } else {
    console.log('\nNo league member found for "your" pool. Pass your slug:');
    console.log(`  npx tsx server/scripts/seed-card-pools-demo.ts <your-slug>`);
    console.log('\nYou will still see Demo Player under "All pools" if you are a league member without a pool (amber notice).');
  }

  console.log('\nDone. Open Card Pools while signed in as a league member:');
  console.log(`  ${process.env.CLIENT_URL ?? 'http://localhost:5173'}/pools`);
  console.log(`  League: ${league.name} | Season ${season.number}`);
  console.log(`  Demo Player → ${altProduct.name}`);
  if (targetUser) {
    console.log(`  You (${targetUser.slug}) → check "Your pool" at the top`);
  }

  void demoMembership;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
