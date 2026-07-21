import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';
import { addMember } from '../src/services/leagueService.js';
import { createPool } from '../src/services/cardPoolService.js';

const GOOGLE_USER_SLUG = 'scott-harris';

async function main() {
  const user = await prisma.user.findUnique({
    where: { slug: GOOGLE_USER_SLUG },
    select: { id: true, displayName: true, slug: true, googleId: true },
  });

  if (!user?.googleId) {
    console.error(`Google user "${GOOGLE_USER_SLUG}" not found. Sign in with Google first.`);
    process.exit(1);
  }

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: { league: { select: { slug: true, name: true } } },
  });

  if (!season) {
    console.error('No active season found.');
    process.exit(1);
  }

  const existingMembership = await prisma.leagueMembership.findUnique({
    where: {
      userId_leagueId: { userId: user.id, leagueId: season.leagueId },
    },
  });

  if (!existingMembership) {
    await addMember(season.league.slug, user.id);
    console.log(`Added ${user.displayName} to league "${season.league.name}".`);
  } else {
    console.log(`${user.displayName} is already a league member.`);
  }

  const existingPool = await prisma.cardPool.findUnique({
    where: {
      userId_seasonId: { userId: user.id, seasonId: season.id },
    },
  });

  if (existingPool) {
    console.log(`${user.displayName} already has a pool for ${season.name}.`);
    return;
  }

  const product =
    (await prisma.boosterProduct.findFirst({
      where: { name: { contains: 'Play', mode: 'insensitive' } },
      orderBy: { name: 'asc' },
    })) ??
    (await prisma.boosterProduct.findFirst({ orderBy: { name: 'asc' } }));

  if (!product) {
    console.error('No booster products found.');
    process.exit(1);
  }

  const pool = await createPool(user.id, season.id, product.id);
  console.log(`Created pool (${product.name}) for ${user.displayName} in ${season.name}.`);
  console.log(`Pool id: ${pool.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
