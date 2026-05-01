import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listPoolsBySeason(seasonId: string) {
  return prisma.cardPool.findMany({
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
      boosterProduct: {
        include: {
          setCodes: true,
        },
      },
    },
    orderBy: [{ user: { displayName: 'asc' } }],
  });
}

export async function createPool(userId: string, seasonId: string, boosterProductId: string) {
  const boosterProduct = await prisma.boosterProduct.findUnique({
    where: { id: boosterProductId },
    select: { id: true },
  });
  if (!boosterProduct) {
    throw new AppError(404, 'NOT_FOUND', 'Booster product not found');
  }

  const existing = await prisma.cardPool.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'User already has a pool for this season');
  }

  return prisma.cardPool.create({
    data: {
      userId,
      seasonId,
      boosterProductId,
    },
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
      boosterProduct: {
        include: {
          setCodes: true,
        },
      },
    },
  });
}

export async function updatePool(poolId: string, boosterProductId: string) {
  const existing = await prisma.cardPool.findUnique({
    where: { id: poolId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Card pool not found');
  }

  const boosterProduct = await prisma.boosterProduct.findUnique({
    where: { id: boosterProductId },
    select: { id: true },
  });
  if (!boosterProduct) {
    throw new AppError(404, 'NOT_FOUND', 'Booster product not found');
  }

  return prisma.cardPool.update({
    where: { id: poolId },
    data: { boosterProductId },
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
      boosterProduct: {
        include: {
          setCodes: true,
        },
      },
    },
  });
}

export async function deletePool(poolId: string) {
  const existing = await prisma.cardPool.findUnique({
    where: { id: poolId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Card pool not found');
  }

  await prisma.cardPool.delete({
    where: { id: poolId },
  });
}
