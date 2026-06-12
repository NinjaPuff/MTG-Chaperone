import type { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  importSetFromScryfall,
  lookupCanonicalByName,
  resolveCanonicalSetCode,
} from './scryfallService.js';

export type DeletedCachedCard = {
  scryfallId: string;
  name: string;
  setCode: string;
};

export type PoolStaleUsage = {
  entryId: string;
  poolId: string;
  userId: string;
  displayName: string;
  quantity: number;
  phaseLabel: string;
};

export type DecklistStaleUsage = {
  entryId: string;
  decklistId: string;
  userId: string;
  displayName: string;
  quantity: number;
  eventName: string;
  roundLabel: string;
};

export type SuggestedReplacement = {
  scryfallId: string;
  name: string;
  collectorNumber: string | null;
};

export type StaleReference = {
  scryfallId: string;
  name: string;
  setCode: string;
  suggestedReplacement: SuggestedReplacement | null;
  poolUsages: PoolStaleUsage[];
  decklistUsages: DecklistStaleUsage[];
};

export type ResolveStaleAction =
  | { target: 'pool'; entryId: string; action: 'replace'; replacementScryfallId: string }
  | { target: 'pool'; entryId: string; action: 'remove' }
  | { target: 'decklist'; entryId: string; action: 'replace'; replacementScryfallId: string }
  | { target: 'decklist'; entryId: string; action: 'remove' };

export type ResolveStaleReferencesResult = {
  resolved: number;
  errors: Array<{ index: number; entryId: string; message: string }>;
};

export type ClearSetCacheResult = {
  setCode: string;
  canonicalSetCode: string;
  deleted: number;
  deletedCards: DeletedCachedCard[];
};

export type ClearAndImportSetResult = ClearSetCacheResult & {
  imported: number;
  importedScryfallIds: string[];
  staleReferences: StaleReference[];
  error?: string;
};

type CardCacheDeps = {
  prisma: PrismaClient;
  resolveCanonicalSetCode: (setCode: string) => Promise<string>;
  importSetFromScryfall: typeof importSetFromScryfall;
  lookupCanonicalByName: typeof lookupCanonicalByName;
};

function toRoundLabel(roundNumber: number | null | undefined) {
  if (typeof roundNumber !== 'number') {
    return 'Round';
  }
  return `Round ${roundNumber}`;
}

export function createCardCacheService(partialDeps?: Partial<CardCacheDeps>) {
  const deps: CardCacheDeps = {
    prisma,
    resolveCanonicalSetCode,
    importSetFromScryfall,
    lookupCanonicalByName,
    ...partialDeps,
  };

  async function clearSetCache(setCode: string): Promise<ClearSetCacheResult> {
    const requestedSetCode = setCode.trim().toUpperCase();
    if (!requestedSetCode) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Set code is required');
    }

    const canonicalSetCode = await deps.resolveCanonicalSetCode(requestedSetCode);
    const cardsToDelete = await deps.prisma.cachedCard.findMany({
      where: {
        setCode: { equals: canonicalSetCode, mode: 'insensitive' },
        cardPoolEntries: { none: {} },
        decklistEntries: { none: {} },
      },
      select: {
        scryfallId: true,
        name: true,
        setCode: true,
      },
    });

    if (cardsToDelete.length === 0) {
      return {
        setCode: requestedSetCode,
        canonicalSetCode,
        deleted: 0,
        deletedCards: [],
      };
    }

    const deleted = await deps.prisma.cachedCard.deleteMany({
      where: {
        scryfallId: { in: cardsToDelete.map((card) => card.scryfallId) },
      },
    });

    return {
      setCode: requestedSetCode,
      canonicalSetCode,
      deleted: deleted.count,
      deletedCards: cardsToDelete,
    };
  }

  async function suggestPaperReplacement(name: string, setCode: string): Promise<SuggestedReplacement | null> {
    try {
      const match = await deps.lookupCanonicalByName(name, [setCode]);
      if (match) {
        return {
          scryfallId: match.scryfallId,
          name: match.name,
          collectorNumber: match.collectorNumber ?? null,
        };
      }

      if (name.startsWith('A-')) {
        const strippedMatch = await deps.lookupCanonicalByName(name.slice(2), [setCode]);
        if (strippedMatch) {
          return {
            scryfallId: strippedMatch.scryfallId,
            name: strippedMatch.name,
            collectorNumber: strippedMatch.collectorNumber ?? null,
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async function findStaleReferences(setCode: string, importedScryfallIds: string[]): Promise<StaleReference[]> {
    const canonicalSetCode = await deps.resolveCanonicalSetCode(setCode);
    const imported = new Set(importedScryfallIds);

    const poolWhere = {
      cachedCard: { setCode: { equals: canonicalSetCode, mode: 'insensitive' as const } },
      ...(imported.size > 0 ? { cachedCardId: { notIn: [...imported] } } : {}),
    };
    const deckWhere = {
      cachedCard: { setCode: { equals: canonicalSetCode, mode: 'insensitive' as const } },
      ...(imported.size > 0 ? { cachedCardId: { notIn: [...imported] } } : {}),
    };

    const [poolEntries, decklistEntries] = await Promise.all([
      deps.prisma.cardPoolEntry.findMany({
        where: poolWhere,
        select: {
          id: true,
          quantity: true,
          cachedCardId: true,
          cachedCard: {
            select: {
              scryfallId: true,
              name: true,
              setCode: true,
            },
          },
          acquisition: {
            select: {
              phaseLabel: true,
              cardPool: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      deps.prisma.decklistEntry.findMany({
        where: deckWhere,
        select: {
          id: true,
          quantity: true,
          cachedCardId: true,
          cachedCard: {
            select: {
              scryfallId: true,
              name: true,
              setCode: true,
            },
          },
          decklist: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
              event: {
                select: {
                  name: true,
                },
              },
              round: {
                select: {
                  roundNumber: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const staleByScryfallId = new Map<string, Omit<StaleReference, 'suggestedReplacement'>>();

    for (const entry of poolEntries) {
      const key = entry.cachedCard.scryfallId;
      if (!staleByScryfallId.has(key)) {
        staleByScryfallId.set(key, {
          scryfallId: entry.cachedCard.scryfallId,
          name: entry.cachedCard.name,
          setCode: entry.cachedCard.setCode,
          poolUsages: [],
          decklistUsages: [],
        });
      }
      staleByScryfallId.get(key)!.poolUsages.push({
        entryId: entry.id,
        poolId: entry.acquisition.cardPool.id,
        userId: entry.acquisition.cardPool.user.id,
        displayName: entry.acquisition.cardPool.user.displayName,
        quantity: entry.quantity,
        phaseLabel: entry.acquisition.phaseLabel,
      });
    }

    for (const entry of decklistEntries) {
      const key = entry.cachedCard.scryfallId;
      if (!staleByScryfallId.has(key)) {
        staleByScryfallId.set(key, {
          scryfallId: entry.cachedCard.scryfallId,
          name: entry.cachedCard.name,
          setCode: entry.cachedCard.setCode,
          poolUsages: [],
          decklistUsages: [],
        });
      }
      staleByScryfallId.get(key)!.decklistUsages.push({
        entryId: entry.id,
        decklistId: entry.decklist.id,
        userId: entry.decklist.user.id,
        displayName: entry.decklist.user.displayName,
        quantity: entry.quantity,
        eventName: entry.decklist.event.name,
        roundLabel: toRoundLabel(entry.decklist.round.roundNumber),
      });
    }

    const grouped = [...staleByScryfallId.values()];
    return Promise.all(
      grouped.map(async (reference) => ({
        ...reference,
        suggestedReplacement: await suggestPaperReplacement(reference.name, setCode),
      })),
    );
  }

  async function clearAndImportSet(setCode: string): Promise<ClearAndImportSetResult> {
    const cleared = await clearSetCache(setCode);

    const imported = await deps.importSetFromScryfall(cleared.setCode);
    const staleReferences = await findStaleReferences(cleared.setCode, imported.importedScryfallIds);
    return {
      ...cleared,
      imported: imported.imported,
      importedScryfallIds: imported.importedScryfallIds,
      staleReferences,
      error: imported.error,
    };
  }

  async function resolveStaleReferences(actions: ResolveStaleAction[]): Promise<ResolveStaleReferencesResult> {
    let resolved = 0;
    const errors: Array<{ index: number; entryId: string; message: string }> = [];
    const replacedCardIds = new Set<string>();

    for (const [index, action] of actions.entries()) {
      try {
        const oldCardId = await deps.prisma.$transaction(async (tx) => {
          if (action.target === 'pool') {
            const entry = await tx.cardPoolEntry.findUnique({
              where: { id: action.entryId },
              select: {
                id: true,
                acquisitionId: true,
                cachedCardId: true,
                quantity: true,
              },
            });
            if (!entry) {
              throw new AppError(404, 'NOT_FOUND', 'Pool entry not found');
            }

            if (action.action === 'remove') {
              await tx.cardPoolEntry.delete({ where: { id: entry.id } });
              const remaining = await tx.cardPoolEntry.count({ where: { acquisitionId: entry.acquisitionId } });
              if (remaining === 0) {
                await tx.poolAcquisition.delete({ where: { id: entry.acquisitionId } });
              }
              return null;
            }

            const replacement = await tx.cachedCard.findUnique({
              where: { scryfallId: action.replacementScryfallId },
              select: { scryfallId: true },
            });
            if (!replacement) {
              throw new AppError(404, 'NOT_FOUND', 'Replacement card not found');
            }

            if (entry.cachedCardId === replacement.scryfallId) {
              return null;
            }

            const oldId = entry.cachedCardId;

            const duplicate = await tx.cardPoolEntry.findFirst({
              where: {
                acquisitionId: entry.acquisitionId,
                cachedCardId: replacement.scryfallId,
                id: { not: entry.id },
              },
              select: { id: true, quantity: true },
            });

            if (duplicate) {
              await tx.cardPoolEntry.update({
                where: { id: duplicate.id },
                data: { quantity: duplicate.quantity + entry.quantity },
              });
              await tx.cardPoolEntry.delete({ where: { id: entry.id } });
            } else {
              await tx.cardPoolEntry.update({
                where: { id: entry.id },
                data: { cachedCardId: replacement.scryfallId },
              });
            }
            return oldId;
          }

          const entry = await tx.decklistEntry.findUnique({
            where: { id: action.entryId },
            select: {
              id: true,
              decklistId: true,
              cachedCardId: true,
              zone: true,
              quantity: true,
            },
          });
          if (!entry) {
            throw new AppError(404, 'NOT_FOUND', 'Decklist entry not found');
          }

          if (action.action === 'remove') {
            await tx.decklistEntry.delete({ where: { id: entry.id } });
            return null;
          }

          const replacement = await tx.cachedCard.findUnique({
            where: { scryfallId: action.replacementScryfallId },
            select: { scryfallId: true },
          });
          if (!replacement) {
            throw new AppError(404, 'NOT_FOUND', 'Replacement card not found');
          }

          if (entry.cachedCardId === replacement.scryfallId) {
            return null;
          }

          const oldId = entry.cachedCardId;

          const duplicate = await tx.decklistEntry.findFirst({
            where: {
              decklistId: entry.decklistId,
              zone: entry.zone,
              cachedCardId: replacement.scryfallId,
              id: { not: entry.id },
            },
            select: { id: true, quantity: true },
          });

          if (duplicate) {
            await tx.decklistEntry.update({
              where: { id: duplicate.id },
              data: { quantity: duplicate.quantity + entry.quantity },
            });
            await tx.decklistEntry.delete({ where: { id: entry.id } });
          } else {
            await tx.decklistEntry.update({
              where: { id: entry.id },
              data: { cachedCardId: replacement.scryfallId },
            });
          }
          return oldId;
        });

        resolved += 1;
        if (oldCardId) {
          replacedCardIds.add(oldCardId);
        }
      } catch (error) {
        errors.push({
          index,
          entryId: action.entryId,
          message: error instanceof Error ? error.message : 'Failed to resolve stale reference',
        });
      }
    }

    for (const oldCardId of replacedCardIds) {
      const poolRefs = await deps.prisma.cardPoolEntry.count({ where: { cachedCardId: oldCardId } });
      const deckRefs = await deps.prisma.decklistEntry.count({ where: { cachedCardId: oldCardId } });
      if (poolRefs === 0 && deckRefs === 0) {
        await deps.prisma.cachedCard.delete({ where: { scryfallId: oldCardId } });
      }
    }

    return { resolved, errors };
  }

  return {
    clearSetCache,
    suggestPaperReplacement,
    findStaleReferences,
    clearAndImportSet,
    resolveStaleReferences,
  };
}

const defaultCardCacheService = createCardCacheService();
export const clearSetCache = defaultCardCacheService.clearSetCache;
export const suggestPaperReplacement = defaultCardCacheService.suggestPaperReplacement;
export const findStaleReferences = defaultCardCacheService.findStaleReferences;
export const clearAndImportSet = defaultCardCacheService.clearAndImportSet;
export const resolveStaleReferences = defaultCardCacheService.resolveStaleReferences;
