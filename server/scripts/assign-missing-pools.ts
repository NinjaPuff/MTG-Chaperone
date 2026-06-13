import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';
import { createPool } from '../src/services/cardPoolService.js';

async function main() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: {
      league: {
        include: {
          memberships: {
            include: { user: { select: { id: true, slug: true, displayName: true } } },
          },
        },
      },
      cardPools: { select: { userId: true } },
    },
  });

  if (!season) {
    console.error('No active season.');
    process.exit(1);
  }

  const poolUserIds = new Set(season.cardPools.map((pool) => pool.userId));
  const missingMembers = season.league.memberships.filter((membership) => !poolUserIds.has(membership.userId));

  if (missingMembers.length === 0) {
    console.log('All league members already have pools.');
    return;
  }

  const products = await prisma.boosterProduct.findMany({ orderBy: { name: 'asc' } });
  if (products.length === 0) {
    console.error('No booster products found.');
    process.exit(1);
  }

  for (const [index, membership] of missingMembers.entries()) {
    const product = products[index % products.length];
    await createPool(membership.userId, season.id, product.id);
    console.log(`Assigned ${product.name} to ${membership.user.displayName} (${membership.user.slug})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
