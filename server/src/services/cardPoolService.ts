import {
  expandCardNameLookupVariants,
  parseDecklistLine,
  slashAliasKeysForIndexedName,
} from '@mtg-league/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { expandPhaseLabelMatches, normalizePhaseLabel } from '../lib/poolRules.js';
import {
  bulkLookupForPoolImport,
  getCard,
  lookupCanonicalByName,
  tryResolvePrintingInPoolSet,
} from './scryfallService.js';
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
              layout: true,
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
  const trimmedPhaseLabel = normalizePhaseLabel(phaseLabel);
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
              layout: true,
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

type BulkResolveCandidate = {
  scryfallId: string;
  name: string;
  flavorName?: string | null;
  setCode: string;
  collectorNumber?: string | null;
  imageUris: unknown;
  manaCost: string | null;
};

export function filterBulkResolveCandidates(
  cards: BulkResolveCandidate[],
  specifiedSetCode: string | null,
  specifiedCollectorNumber: string | null,
  allowedSetCodes: Set<string>,
): BulkResolveCandidate[] {
  const filteredByAllowedSet = cards.filter(
    (card) => allowedSetCodes.size === 0 || allowedSetCodes.has(card.setCode.toUpperCase()),
  );
  const inSpecifiedSet = filteredByAllowedSet.filter(
    (card) => !specifiedSetCode || card.setCode.toUpperCase() === specifiedSetCode,
  );

  if (!specifiedCollectorNumber) {
    return inSpecifiedSet;
  }

  const withCollector = inSpecifiedSet.filter(
    (card) => (card.collectorNumber ?? '').toLowerCase() === specifiedCollectorNumber.toLowerCase(),
  );
  if (withCollector.length > 0) {
    return withCollector;
  }

  const withStoredCollector = inSpecifiedSet.filter((card) => card.collectorNumber?.trim());
  if (withStoredCollector.length > 0) {
    return [];
  }

  return inSpecifiedSet;
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

  type CachedLookupCard = (typeof lookupCards)[number];

  const addCandidate = (map: Map<string, CachedLookupCard[]>, key: string, card: CachedLookupCard) => {
    const existing = map.get(key);
    if (existing) {
      existing.push(card);
      return;
    }
    map.set(key, [card]);
  };

  const candidatesByOracleName = new Map<string, CachedLookupCard[]>();
  const candidatesByFlavorName = new Map<string, CachedLookupCard[]>();
  for (const card of lookupCards) {
    for (const key of slashAliasKeysForIndexedName(card.name).map((oracleKey) => oracleKey.toLowerCase())) {
      addCandidate(candidatesByOracleName, key, card);
    }
    if (card.name.includes(' // ')) {
      const parts = card.name.split(' // ');
      if (parts.length === 2) {
        for (const face of parts) {
          const faceKey = face.trim().toLowerCase();
          if (faceKey) {
            addCandidate(candidatesByOracleName, faceKey, card);
          }
        }
      }
    }
    const flavorKey = card.flavorName?.trim().toLowerCase();
    if (flavorKey) {
      addCandidate(candidatesByFlavorName, flavorKey, card);
    }
  }

  const lookupKeysForItem = (name: string) =>
    expandCardNameLookupVariants(name).map((variant) => variant.toLowerCase());

  const candidatesForItem = (name: string) => {
    for (const key of lookupKeysForItem(name)) {
      const byOracle = candidatesByOracleName.get(key);
      if (byOracle?.length) {
        return byOracle;
      }
    }
    for (const key of lookupKeysForItem(name)) {
      const byFlavor = candidatesByFlavorName.get(key);
      if (byFlavor?.length) {
        return byFlavor;
      }
    }
    return [];
  };

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
    if (item.specifiedSetCode && allowedSetCodes.size > 0 && !allowedSetCodes.has(item.specifiedSetCode)) {
      item.specifiedSetCode = null;
      item.specifiedCollectorNumber = null;
    }

    const candidates = filterBulkResolveCandidates(
      candidatesForItem(item.name),
      item.specifiedSetCode,
      item.specifiedCollectorNumber,
      allowedSetCodes,
    ).sort((a, b) => a.setCode.localeCompare(b.setCode) || a.scryfallId.localeCompare(b.scryfallId));

    let match: BulkResolveCandidate | undefined = candidates[0];
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

    if (!match && item.specifiedSetCode) {
      try {
        const fetched = await tryResolvePrintingInPoolSet(
          item.name,
          item.specifiedSetCode,
          item.specifiedCollectorNumber,
          [...allowedSetCodes],
        );
        if (fetched) {
          match = fetched;
        }
      } catch {
        // Fall through to unresolved.
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
  const labelMatches = expandPhaseLabelMatches(phaseLabel);
  if (labelMatches.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Phase label is required');
  }

  await prisma.poolAcquisition.deleteMany({
    where: {
      cardPoolId: poolId,
      phaseLabel: { in: labelMatches },
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
  const normalizedPhaseLabel = normalizePhaseLabel(phaseLabel);
  if (!normalizedPhaseLabel) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Phase label is required');
  }

  if (!cachedCardId.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Card id is required');
  }

  const phaseLabelMatches = expandPhaseLabelMatches(normalizedPhaseLabel);

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
        phaseLabel: { in: phaseLabelMatches },
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
