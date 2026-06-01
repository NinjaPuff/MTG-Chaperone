import {
  expandCardNameLookupVariants,
  parseDecklistLine,
  slashAliasKeysForIndexedName,
} from '@mtg-league/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { bulkLookupForPoolImport, getCard, lookupCanonicalByName } from './scryfallService.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';

async function refreshStaleDfcManaCost(cachedCardIds: string[]) {
  if (cachedCardIds.length === 0) {
    return;
  }

  const cards = await prisma.cachedCard.findMany({
    where: {
      scryfallId: {
        in: cachedCardIds,
      },
    },
    select: {
      scryfallId: true,
      name: true,
      manaCost: true,
      cmc: true,
    },
  });

  const staleIds = cards
    .filter((card) => card.manaCost === null && card.cmc > 0 && card.name.includes('//'))
    .map((card) => card.scryfallId);

  for (const scryfallId of staleIds) {
    try {
      await getCard(scryfallId);
    } catch {
      // Ignore refresh failures; create flow will still use cached row.
    }
  }
}

export async function listPoolsBySeason(seasonId: string) {
  return prisma.cardPool.findMany({
    where: { seasonId },
    include: {
        user: {
          select: USER_PUBLIC_SELECT,
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
          select: USER_PUBLIC_SELECT,
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
          select: USER_PUBLIC_SELECT,
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
          select: USER_PUBLIC_SELECT,
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
              collectorNumber: true,
              imageUris: true,
              manaCost: true,
              typeLine: true,
              rarity: true,
              cmc: true,
              colors: true,
              colorIdentity: true,
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
  await refreshStaleDfcManaCost(uniqueCachedCardIds);
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
              cmc: true,
              colors: true,
              colorIdentity: true,
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

function parseBulkItemLine(item: BulkItemInput) {
  const parsed = parseDecklistLine(`${item.quantity} ${item.name}`);
  return {
    inputLabel: item.name,
    name: parsed.name,
    quantity: parsed.quantity,
    specifiedSetCode: parsed.setCode ?? null,
    specifiedCollectorNumber: parsed.collectorNumber ?? null,
  };
}

export async function bulkResolveAcquisitionItems(items: BulkItemInput[], setCodes: string[]) {
  const normalizedItems = items
    .map((item) => parseBulkItemLine(item))
    .filter((item) => item.name.length > 0 && item.quantity > 0);

  if (normalizedItems.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one item is required');
  }

  const lookupNames = [
    ...new Set(normalizedItems.flatMap((item) => expandCardNameLookupVariants(item.name))),
  ];
  const lookupCards = await bulkLookupForPoolImport(lookupNames, setCodes);
  const allowedSetCodes = new Set(setCodes.map((setCode) => setCode.trim().toUpperCase()).filter(Boolean));

  const candidatesByName = new Map<string, typeof lookupCards>();
  for (const card of lookupCards) {
    const keys = slashAliasKeysForIndexedName(card.name).map((key) => key.toLowerCase());
    if (card.flavorName?.trim()) {
      keys.push(card.flavorName.trim().toLowerCase());
    }

    for (const key of keys) {
      const existing = candidatesByName.get(key);
      if (existing) {
        existing.push(card);
      } else {
        candidatesByName.set(key, [card]);
      }
    }
  }

  type ResolvedCardAccumulator = {
    cachedCardId: string;
    quantity: number;
    cachedCard: {
      scryfallId: string;
      name: string;
      flavorName: string | null;
      setCode: string;
      imageUris: unknown;
      manaCost: string | null;
    };
  };

  const resolvedByCardId = new Map<string, ResolvedCardAccumulator>();
  const unresolved: string[] = [];

  for (const item of normalizedItems) {
    const key = item.name.toLowerCase();
    if (item.specifiedSetCode && allowedSetCodes.size > 0 && !allowedSetCodes.has(item.specifiedSetCode)) {
      unresolved.push(item.inputLabel);
      continue;
    }

    const filteredByAllowedSet = (candidatesByName.get(key) ?? []).filter(
      (card) => allowedSetCodes.size === 0 || allowedSetCodes.has(card.setCode.toUpperCase()),
    );
    const candidates = filteredByAllowedSet
      .filter((card) => !item.specifiedSetCode || card.setCode.toUpperCase() === item.specifiedSetCode)
      .filter(
        (card) =>
          !item.specifiedCollectorNumber ||
          (card.collectorNumber ?? '').toLowerCase() === item.specifiedCollectorNumber.toLowerCase(),
      )
      .sort((a, b) => a.setCode.localeCompare(b.setCode) || a.scryfallId.localeCompare(b.scryfallId));

    let match = candidates[0];
    if (!item.specifiedSetCode && !item.specifiedCollectorNumber && candidates.length > 1) {
      try {
        const canonical = await lookupCanonicalByName(item.name, [...allowedSetCodes]);
        if (canonical) {
          const canonicalSetCode = canonical.setCode.toUpperCase();
          const canonicalAllowed = allowedSetCodes.size === 0 || allowedSetCodes.has(canonicalSetCode);
          if (canonicalAllowed) {
            match = candidates.find((card) => card.scryfallId === canonical.scryfallId) ?? canonical;
          }
        }
      } catch {
        // Fall back to deterministic local candidate ordering.
      }
    }

    if (!match) {
      unresolved.push(item.inputLabel);
      continue;
    }

    const existing = resolvedByCardId.get(match.scryfallId);
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    resolvedByCardId.set(match.scryfallId, {
      cachedCardId: match.scryfallId,
      quantity: item.quantity,
      cachedCard: {
        scryfallId: match.scryfallId,
        name: match.name,
        flavorName: match.flavorName ?? null,
        setCode: match.setCode,
        imageUris: match.imageUris,
        manaCost: match.manaCost,
      },
    });
  }

  return {
    resolved: [...resolvedByCardId.values()],
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

export async function clearPhaseAcquisitions(poolId: string, phaseLabel: string) {
  const normalizedPhaseLabel = phaseLabel.trim();
  if (!normalizedPhaseLabel) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Phase label is required');
  }

  await prisma.poolAcquisition.deleteMany({
    where: {
      cardPoolId: poolId,
      phaseLabel: normalizedPhaseLabel,
    },
  });
}

type AdjustCardQuantityAction = 'add' | 'remove_one' | 'remove_all';

export async function adjustCardQuantityInPhase(
  poolId: string,
  phaseLabel: string,
  cachedCardId: string,
  action: AdjustCardQuantityAction,
) {
  const normalizedPhaseLabel = phaseLabel.trim();
  if (!normalizedPhaseLabel) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Phase label is required');
  }

  if (!cachedCardId.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Card id is required');
  }

  if (action === 'add') {
    await refreshStaleDfcManaCost([cachedCardId]);
    await createAcquisition(poolId, normalizedPhaseLabel, [{ cachedCardId, quantity: 1 }]);
    return;
  }

  const entries = await prisma.cardPoolEntry.findMany({
    where: {
      cachedCardId,
      acquisition: {
        cardPoolId: poolId,
        phaseLabel: normalizedPhaseLabel,
      },
    },
    select: {
      id: true,
      quantity: true,
      acquisitionId: true,
      acquisition: {
        select: {
          addedAt: true,
        },
      },
    },
    orderBy: [{ acquisition: { addedAt: 'desc' } }, { id: 'desc' }],
  });

  if (entries.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Card not found in selected acquisition group');
  }

  let remainingToRemove = action === 'remove_one' ? 1 : Number.POSITIVE_INFINITY;
  const affectedAcquisitionIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      if (remainingToRemove <= 0) {
        break;
      }

      const removeAmount = Number.isFinite(remainingToRemove) ? Math.min(entry.quantity, remainingToRemove) : entry.quantity;
      const nextQuantity = entry.quantity - removeAmount;
      affectedAcquisitionIds.add(entry.acquisitionId);

      if (nextQuantity > 0) {
        await tx.cardPoolEntry.update({
          where: { id: entry.id },
          data: { quantity: nextQuantity },
        });
      } else {
        await tx.cardPoolEntry.delete({
          where: { id: entry.id },
        });
      }

      if (Number.isFinite(remainingToRemove)) {
        remainingToRemove -= removeAmount;
      }
    }

    if (remainingToRemove > 0 && Number.isFinite(remainingToRemove)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Not enough copies in selected acquisition group');
    }

    for (const acquisitionId of affectedAcquisitionIds) {
      const remainingEntries = await tx.cardPoolEntry.count({
        where: { acquisitionId },
      });
      if (remainingEntries === 0) {
        await tx.poolAcquisition.delete({
          where: { id: acquisitionId },
        });
      }
    }
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
    bulkResolveAcquisitionItems,
    deleteAcquisition,
    clearPhaseAcquisitions,
    adjustCardQuantityInPhase,
  };
}
