import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { bulkLookupByName } from './scryfallService.js';

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

export async function getPoolDetail(poolId: string) {
  const pool = await prisma.cardPool.findUnique({
    where: { id: poolId },
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
      season: {
        select: {
          id: true,
          name: true,
          number: true,
          league: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!pool) {
    throw new AppError(404, 'NOT_FOUND', 'Card pool not found');
  }

  return pool;
}

export async function listAcquisitions(poolId: string) {
  return prisma.poolAcquisition.findMany({
    where: { cardPoolId: poolId },
    include: {
      entries: {
        include: {
          cachedCard: {
            select: {
              scryfallId: true,
              name: true,
              setCode: true,
              imageUris: true,
              manaCost: true,
              typeLine: true,
              rarity: true,
            },
          },
        },
      },
    },
    orderBy: { addedAt: 'asc' },
  });
}

type AcquisitionCardInput = {
  cachedCardId: string;
  quantity: number;
};

export async function createAcquisition(poolId: string, phaseLabel: string, cards: AcquisitionCardInput[]) {
  const trimmedPhaseLabel = phaseLabel.trim();
  if (!trimmedPhaseLabel) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Phase label is required');
  }

  if (cards.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one card is required');
  }

  const uniqueCachedCardIds = [...new Set(cards.map((card) => card.cachedCardId))];
  const existingCards = await prisma.cachedCard.findMany({
    where: {
      scryfallId: {
        in: uniqueCachedCardIds,
      },
    },
    select: {
      scryfallId: true,
    },
  });

  const existingIds = new Set(existingCards.map((card) => card.scryfallId));
  const missingIds = uniqueCachedCardIds.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Some cards could not be found in cache: ${missingIds.join(', ')}`,
    );
  }

  return prisma.poolAcquisition.create({
    data: {
      cardPoolId: poolId,
      phaseLabel: trimmedPhaseLabel,
      approvalStatus: 'approved',
      entries: {
        create: cards.map((card) => ({
          cachedCardId: card.cachedCardId,
          quantity: card.quantity,
        })),
      },
    },
    include: {
      entries: {
        include: {
          cachedCard: {
            select: {
              scryfallId: true,
              name: true,
              setCode: true,
              imageUris: true,
              manaCost: true,
              typeLine: true,
              rarity: true,
            },
          },
        },
      },
    },
  });
}

type BulkItemInput = {
  name: string;
  quantity: number;
};

export async function bulkCreateAcquisition(
  poolId: string,
  phaseLabel: string,
  items: BulkItemInput[],
  setCodes: string[],
) {
  const normalizedItems = items
    .map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
    }))
    .filter((item) => item.name.length > 0 && item.quantity > 0);

  if (normalizedItems.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one item is required');
  }

  const lookupCards = await bulkLookupByName(normalizedItems.map((item) => item.name));
  const allowedSetCodes = new Set(setCodes.map((setCode) => setCode.trim().toUpperCase()).filter(Boolean));

  const candidatesByName = new Map<string, typeof lookupCards>();
  for (const card of lookupCards) {
    const key = card.name.toLowerCase();
    const existing = candidatesByName.get(key);
    if (existing) {
      existing.push(card);
    } else {
      candidatesByName.set(key, [card]);
    }
  }

  const resolvedCards: AcquisitionCardInput[] = [];
  const unresolved: string[] = [];

  for (const item of normalizedItems) {
    const key = item.name.toLowerCase();
    const candidates = (candidatesByName.get(key) ?? [])
      .filter((card) => allowedSetCodes.size === 0 || allowedSetCodes.has(card.setCode.toUpperCase()))
      .sort((a, b) => a.setCode.localeCompare(b.setCode) || a.scryfallId.localeCompare(b.scryfallId));

    const match = candidates[0];
    if (!match) {
      unresolved.push(item.name);
      continue;
    }

    resolvedCards.push({
      cachedCardId: match.scryfallId,
      quantity: item.quantity,
    });
  }

  if (resolvedCards.length === 0) {
    return {
      acquisition: null,
      unresolved,
    };
  }

  const quantityByCardId = new Map<string, number>();
  for (const card of resolvedCards) {
    quantityByCardId.set(card.cachedCardId, (quantityByCardId.get(card.cachedCardId) ?? 0) + card.quantity);
  }

  const aggregatedCards = [...quantityByCardId.entries()].map(([cachedCardId, quantity]) => ({
    cachedCardId,
    quantity,
  }));

  const acquisition = await createAcquisition(poolId, phaseLabel, aggregatedCards);
  return {
    acquisition,
    unresolved,
  };
}

export async function deleteAcquisition(acquisitionId: string) {
  const existing = await prisma.poolAcquisition.findUnique({
    where: { id: acquisitionId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Acquisition not found');
  }

  await prisma.poolAcquisition.delete({
    where: { id: acquisitionId },
  });
}

export function createCardPoolService() {
  return {
    listPoolsBySeason,
    createPool,
    updatePool,
    deletePool,
    getPoolDetail,
    listAcquisitions,
    createAcquisition,
    bulkCreateAcquisition,
    deleteAcquisition,
  };
}
