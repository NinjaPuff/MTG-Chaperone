import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardCacheService, type ResolveStaleAction } from '../../services/cardCacheService.js';

function createPrismaMock() {
  const tx = {
    cachedCard: {
      findUnique: vi.fn(),
    },
    cardPoolEntry: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    decklistEntry: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    poolAcquisition: {
      delete: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      cachedCard: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
        findUnique: vi.fn(),
      },
      cardPoolEntry: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      decklistEntry: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    },
  };
}

describe('cardCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clearSetCache deletes only unreferenced rows for canonical set code', async () => {
    const { prisma } = createPrismaMock();
    prisma.cachedCard.findMany.mockResolvedValue([
      { scryfallId: 'old-1', name: 'Old Card', setCode: 'TMT' },
    ]);
    prisma.cachedCard.deleteMany.mockResolvedValue({ count: 1 });

    const resolveCanonicalSetCode = vi.fn(async () => 'TMT');
    const service = createCardCacheService({
      prisma: prisma as never,
      resolveCanonicalSetCode,
    });

    const result = await service.clearSetCache('TMNT');

    expect(resolveCanonicalSetCode).toHaveBeenCalledWith('TMNT');
    expect(prisma.cachedCard.findMany).toHaveBeenCalledWith({
      where: {
        setCode: { equals: 'TMT', mode: 'insensitive' },
        cardPoolEntries: { none: {} },
        decklistEntries: { none: {} },
      },
      select: { scryfallId: true, name: true, setCode: true },
    });
    expect(prisma.cachedCard.deleteMany).toHaveBeenCalledWith({
      where: { scryfallId: { in: ['old-1'] } },
    });
    expect(result).toEqual({
      setCode: 'TMNT',
      canonicalSetCode: 'TMT',
      deleted: 1,
      deletedCards: [{ scryfallId: 'old-1', name: 'Old Card', setCode: 'TMT' }],
    });
  });

  it('clearAndImportSet orchestrates clear, import, and stale lookup in order', async () => {
    const { prisma } = createPrismaMock();
    prisma.cachedCard.findMany.mockResolvedValue([]);
    prisma.cachedCard.deleteMany.mockResolvedValue({ count: 0 });
    prisma.cardPoolEntry.findMany.mockResolvedValue([]);
    prisma.decklistEntry.findMany.mockResolvedValue([]);
    const importSetFromScryfall = vi.fn(async () => ({
      setCode: 'SNC',
      imported: 3,
      canonicalSetCode: 'SNC',
      importedScryfallIds: ['paper-1', 'paper-2', 'paper-3'],
    }));
    const lookupCanonicalByName = vi.fn(async () => null);
    const resolveCanonicalSetCode = vi.fn(async () => 'SNC');

    const service = createCardCacheService({
      prisma: prisma as never,
      importSetFromScryfall,
      lookupCanonicalByName,
      resolveCanonicalSetCode,
    });

    const result = await service.clearAndImportSet('SNC');

    expect(importSetFromScryfall).toHaveBeenCalledWith('SNC');
    expect(prisma.cardPoolEntry.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.decklistEntry.findMany).toHaveBeenCalledTimes(1);
    expect(result.imported).toBe(3);
    expect(result.importedScryfallIds).toEqual(['paper-1', 'paper-2', 'paper-3']);
  });

  it('clearAndImportSet preserves partial importedScryfallIds on mid-import error', async () => {
    const { prisma } = createPrismaMock();
    prisma.cachedCard.findMany.mockResolvedValue([]);
    prisma.cachedCard.deleteMany.mockResolvedValue({ count: 0 });
    prisma.cardPoolEntry.findMany.mockResolvedValue([]);
    prisma.decklistEntry.findMany.mockResolvedValue([]);
    const importSetFromScryfall = vi.fn(async () => ({
      setCode: 'SNC',
      imported: 100,
      canonicalSetCode: 'SNC',
      importedScryfallIds: ['paper-1', 'paper-2'],
      error: 'Scryfall request failed: 429',
    }));
    const resolveCanonicalSetCode = vi.fn(async () => 'SNC');

    const service = createCardCacheService({
      prisma: prisma as never,
      importSetFromScryfall,
      resolveCanonicalSetCode,
    });

    const result = await service.clearAndImportSet('SNC');

    expect(result.imported).toBe(100);
    expect(result.importedScryfallIds).toEqual(['paper-1', 'paper-2']);
    expect(result.error).toBe('Scryfall request failed: 429');
    expect(prisma.cardPoolEntry.findMany).toHaveBeenCalledTimes(1);
  });

  it('suggestPaperReplacement strips A- prefix to find paper version of alchemy cards', async () => {
    const { prisma } = createPrismaMock();
    const lookupCanonicalByName = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        scryfallId: 'paper-buy-your-silence',
        name: 'Buy Your Silence',
        collectorNumber: '5',
      });

    const service = createCardCacheService({
      prisma: prisma as never,
      lookupCanonicalByName,
      resolveCanonicalSetCode: vi.fn(async () => 'SNC'),
    });

    const result = await service.suggestPaperReplacement('A-Buy Your Silence', 'SNC');

    expect(lookupCanonicalByName).toHaveBeenCalledTimes(2);
    expect(lookupCanonicalByName).toHaveBeenNthCalledWith(1, 'A-Buy Your Silence', ['SNC']);
    expect(lookupCanonicalByName).toHaveBeenNthCalledWith(2, 'Buy Your Silence', ['SNC']);
    expect(result).toEqual({
      scryfallId: 'paper-buy-your-silence',
      name: 'Buy Your Silence',
      collectorNumber: '5',
    });
  });

  it('suggestPaperReplacement does not strip A- when exact name already matches', async () => {
    const { prisma } = createPrismaMock();
    const lookupCanonicalByName = vi.fn().mockResolvedValueOnce({
      scryfallId: 'some-card-id',
      name: 'A-Weird Card',
      collectorNumber: '10',
    });

    const service = createCardCacheService({
      prisma: prisma as never,
      lookupCanonicalByName,
      resolveCanonicalSetCode: vi.fn(async () => 'SNC'),
    });

    const result = await service.suggestPaperReplacement('A-Weird Card', 'SNC');

    expect(lookupCanonicalByName).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      scryfallId: 'some-card-id',
      name: 'A-Weird Card',
      collectorNumber: '10',
    });
  });

  it('suggestPaperReplacement returns null when lookupCanonicalByName throws', async () => {
    const { prisma } = createPrismaMock();
    const lookupCanonicalByName = vi.fn(async () => {
      throw new Error('Scryfall request failed: 503');
    });

    const service = createCardCacheService({
      prisma: prisma as never,
      lookupCanonicalByName,
      resolveCanonicalSetCode: vi.fn(async () => 'SNC'),
    });

    const result = await service.suggestPaperReplacement('A-Buy Your Silence', 'SNC');

    expect(result).toBeNull();
    expect(lookupCanonicalByName).toHaveBeenCalledWith('A-Buy Your Silence', ['SNC']);
  });

  it('clearAndImportSet succeeds when stale cards have no paper replacement', async () => {
    const { prisma } = createPrismaMock();
    prisma.cachedCard.findMany.mockResolvedValue([]);
    prisma.cachedCard.deleteMany.mockResolvedValue({ count: 0 });
    prisma.cardPoolEntry.findMany.mockResolvedValue([
      {
        id: 'pool-entry-1',
        quantity: 1,
        cachedCardId: 'digital-alchemy-id',
        cachedCard: { scryfallId: 'digital-alchemy-id', name: 'A-Buy Your Silence', setCode: 'SNC' },
        acquisition: {
          phaseLabel: 'Initial Pool',
          cardPool: {
            id: 'pool-1',
            user: { id: 'user-1', displayName: 'Alice' },
          },
        },
      },
    ]);
    prisma.decklistEntry.findMany.mockResolvedValue([]);
    const importSetFromScryfall = vi.fn(async () => ({
      setCode: 'SNC',
      imported: 200,
      canonicalSetCode: 'SNC',
      importedScryfallIds: ['paper-1', 'paper-2'],
    }));
    const lookupCanonicalByName = vi.fn(async () => {
      throw new Error('Network failure');
    });
    const resolveCanonicalSetCode = vi.fn(async () => 'SNC');

    const service = createCardCacheService({
      prisma: prisma as never,
      importSetFromScryfall,
      lookupCanonicalByName,
      resolveCanonicalSetCode,
    });

    const result = await service.clearAndImportSet('SNC');

    expect(result.imported).toBe(200);
    expect(result.error).toBeUndefined();
    expect(result.staleReferences).toHaveLength(1);
    expect(result.staleReferences[0].scryfallId).toBe('digital-alchemy-id');
    expect(result.staleReferences[0].suggestedReplacement).toBeNull();
  });

  it('findStaleReferences returns pool and decklist usages for non-imported cards', async () => {
    const { prisma } = createPrismaMock();
    prisma.cardPoolEntry.findMany.mockResolvedValue([
      {
        id: 'pool-entry-1',
        quantity: 2,
        cachedCardId: 'digital-snc',
        cachedCard: { scryfallId: 'digital-snc', name: 'A-Some Card', setCode: 'SNC' },
        acquisition: {
          phaseLabel: 'Initial Pool',
          cardPool: {
            id: 'pool-1',
            user: { id: 'user-1', displayName: 'Alice' },
          },
        },
      },
    ]);
    prisma.decklistEntry.findMany.mockResolvedValue([
      {
        id: 'deck-entry-1',
        quantity: 1,
        cachedCardId: 'digital-snc',
        cachedCard: { scryfallId: 'digital-snc', name: 'A-Some Card', setCode: 'SNC' },
        decklist: {
          id: 'deck-1',
          event: { name: 'League Event' },
          round: { roundNumber: 3 },
          user: { id: 'user-2', displayName: 'Bob' },
        },
      },
    ]);
    const lookupCanonicalByName = vi.fn(async () => ({
      scryfallId: 'paper-snc',
      name: 'Some Card',
      collectorNumber: '1',
    }));
    const resolveCanonicalSetCode = vi.fn(async () => 'SNC');

    const service = createCardCacheService({
      prisma: prisma as never,
      lookupCanonicalByName,
      resolveCanonicalSetCode,
    });

    const stale = await service.findStaleReferences('SNC', ['paper-snc']);

    expect(stale).toEqual([
      {
        scryfallId: 'digital-snc',
        name: 'A-Some Card',
        setCode: 'SNC',
        suggestedReplacement: {
          scryfallId: 'paper-snc',
          name: 'Some Card',
          collectorNumber: '1',
        },
        poolUsages: [
          {
            entryId: 'pool-entry-1',
            poolId: 'pool-1',
            userId: 'user-1',
            displayName: 'Alice',
            quantity: 2,
            phaseLabel: 'Initial Pool',
          },
        ],
        decklistUsages: [
          {
            entryId: 'deck-entry-1',
            decklistId: 'deck-1',
            userId: 'user-2',
            displayName: 'Bob',
            quantity: 1,
            eventName: 'League Event',
            roundLabel: 'Round 3',
          },
        ],
      },
    ]);
  });

  it('resolveStaleReferences merges duplicates on pool replace and cleans empty acquisition on remove', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.cachedCard.findUnique.mockResolvedValue({ scryfallId: 'paper-1' });
    tx.cardPoolEntry.findUnique
      .mockResolvedValueOnce({ id: 'pool-entry-1', acquisitionId: 'acq-1', cachedCardId: 'digital-1', quantity: 2 })
      .mockResolvedValueOnce({ id: 'pool-entry-2', acquisitionId: 'acq-2', cachedCardId: 'digital-2', quantity: 1 });
    tx.cardPoolEntry.findFirst.mockResolvedValueOnce({
      id: 'pool-entry-dup',
      acquisitionId: 'acq-1',
      cachedCardId: 'paper-1',
      quantity: 3,
    });
    tx.cardPoolEntry.count.mockResolvedValue(0);

    prisma.cardPoolEntry.count.mockResolvedValue(0);
    prisma.decklistEntry.count.mockResolvedValue(0);

    const service = createCardCacheService({
      prisma: prisma as never,
    });

    const actions: ResolveStaleAction[] = [
      { target: 'pool', entryId: 'pool-entry-1', action: 'replace', replacementScryfallId: 'paper-1' },
      { target: 'pool', entryId: 'pool-entry-2', action: 'remove' },
    ];
    const result = await service.resolveStaleReferences(actions);

    expect(tx.cardPoolEntry.update).toHaveBeenCalledWith({
      where: { id: 'pool-entry-dup' },
      data: { quantity: 5 },
    });
    expect(tx.cardPoolEntry.delete).toHaveBeenCalledWith({ where: { id: 'pool-entry-1' } });
    expect(tx.poolAcquisition.delete).toHaveBeenCalledWith({ where: { id: 'acq-2' } });
    expect(result.errors).toEqual([]);
    expect(result.resolved).toBe(2);
  });

  it('resolveStaleReferences handles decklist replace/remove and invalid replacement ids', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.cachedCard.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ scryfallId: 'paper-2' });
    tx.decklistEntry.findUnique
      .mockResolvedValueOnce({ id: 'deck-entry-1', decklistId: 'deck-1', cachedCardId: 'digital-1', zone: 'main', quantity: 1 })
      .mockResolvedValueOnce({ id: 'deck-entry-2', decklistId: 'deck-1', cachedCardId: 'digital-2', zone: 'main', quantity: 2 });
    tx.decklistEntry.findFirst.mockResolvedValueOnce({
      id: 'deck-entry-dup',
      decklistId: 'deck-1',
      zone: 'main',
      quantity: 3,
    });

    prisma.cardPoolEntry.count.mockResolvedValue(0);
    prisma.decklistEntry.count.mockResolvedValue(0);

    const service = createCardCacheService({
      prisma: prisma as never,
    });

    const actions: ResolveStaleAction[] = [
      { target: 'decklist', entryId: 'deck-entry-1', action: 'replace', replacementScryfallId: 'missing' },
      { target: 'decklist', entryId: 'deck-entry-2', action: 'replace', replacementScryfallId: 'paper-2' },
      { target: 'decklist', entryId: 'deck-entry-3', action: 'remove' },
    ];
    tx.decklistEntry.findUnique.mockResolvedValueOnce(null);

    const result = await service.resolveStaleReferences(actions);

    expect(result.resolved).toBe(1);
    expect(result.errors).toHaveLength(2);
    expect(tx.decklistEntry.update).toHaveBeenCalledWith({
      where: { id: 'deck-entry-dup' },
      data: { quantity: 5 },
    });
    expect(tx.decklistEntry.delete).toHaveBeenCalledWith({ where: { id: 'deck-entry-2' } });
  });

  it('resolveStaleReferences deletes old cached card after replacing all references', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.cachedCard.findUnique.mockResolvedValue({ scryfallId: 'paper-1' });
    tx.cardPoolEntry.findUnique.mockResolvedValueOnce({
      id: 'pool-entry-1',
      acquisitionId: 'acq-1',
      cachedCardId: 'digital-1',
      quantity: 1,
    });
    tx.cardPoolEntry.findFirst.mockResolvedValueOnce(null);
    tx.decklistEntry.findUnique.mockResolvedValueOnce({
      id: 'deck-entry-1',
      decklistId: 'deck-1',
      zone: 'main',
      quantity: 1,
    });
    tx.decklistEntry.findFirst.mockResolvedValueOnce(null);

    prisma.cardPoolEntry.count.mockResolvedValue(0);
    prisma.decklistEntry.count.mockResolvedValue(0);

    const service = createCardCacheService({ prisma: prisma as never });

    const actions: ResolveStaleAction[] = [
      { target: 'pool', entryId: 'pool-entry-1', action: 'replace', replacementScryfallId: 'paper-1' },
      { target: 'decklist', entryId: 'deck-entry-1', action: 'replace', replacementScryfallId: 'paper-1' },
    ];
    const result = await service.resolveStaleReferences(actions);

    expect(result.resolved).toBe(2);
    expect(prisma.cachedCard.delete).toHaveBeenCalledWith({ where: { scryfallId: 'digital-1' } });
  });

  it('resolveStaleReferences does not delete old cached card if references remain', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.cachedCard.findUnique.mockResolvedValue({ scryfallId: 'paper-1' });
    tx.cardPoolEntry.findUnique.mockResolvedValueOnce({
      id: 'pool-entry-1',
      acquisitionId: 'acq-1',
      cachedCardId: 'digital-1',
      quantity: 1,
    });
    tx.cardPoolEntry.findFirst.mockResolvedValueOnce(null);

    prisma.cardPoolEntry.count.mockResolvedValue(1);
    prisma.decklistEntry.count.mockResolvedValue(0);

    const service = createCardCacheService({ prisma: prisma as never });

    const actions: ResolveStaleAction[] = [
      { target: 'pool', entryId: 'pool-entry-1', action: 'replace', replacementScryfallId: 'paper-1' },
    ];
    const result = await service.resolveStaleReferences(actions);

    expect(result.resolved).toBe(1);
    expect(prisma.cachedCard.delete).not.toHaveBeenCalled();
  });
});
