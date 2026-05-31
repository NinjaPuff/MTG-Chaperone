import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  cachedCard: {
    findMany: vi.fn(),
  },
  poolAcquisition: {
    create: vi.fn(),
  },
}));

const scryfallMocks = vi.hoisted(() => ({
  bulkLookupByName: vi.fn(),
  getCard: vi.fn(),
  lookupCanonicalByName: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../services/scryfallService.js', () => ({
  bulkLookupByName: scryfallMocks.bulkLookupByName,
  getCard: scryfallMocks.getCard,
  lookupCanonicalByName: scryfallMocks.lookupCanonicalByName,
}));

import { bulkResolveAcquisitionItems } from '../../services/cardPoolService.js';

const trystanBase = {
  scryfallId: 'base-id',
  name: 'Trystan',
  setCode: 'ECL',
  imageUris: { small: 'https://example.com/base.jpg' },
  manaCost: '{2}{G}',
};

const trystanVariant = {
  scryfallId: 'variant-id',
  name: 'Trystan',
  setCode: 'ECL',
  imageUris: { small: 'https://example.com/variant.jpg' },
  manaCost: '{2}{G}',
};

const trystanAbc = {
  scryfallId: 'other-id',
  name: 'Trystan',
  setCode: 'ABC',
  imageUris: { small: 'https://example.com/abc.jpg' },
  manaCost: '{2}{G}',
};

const lightningBolt = {
  scryfallId: 'bolt-id',
  name: 'Lightning Bolt',
  setCode: 'ECL',
  imageUris: { small: 'https://example.com/bolt.jpg' },
  manaCost: '{R}',
};

describe('cardPoolService bulkResolveAcquisitionItems', () => {
  beforeEach(() => {
    prismaMock.cachedCard.findMany.mockReset();
    prismaMock.poolAcquisition.create.mockReset();
    scryfallMocks.bulkLookupByName.mockReset();
    scryfallMocks.getCard.mockReset();
    scryfallMocks.lookupCanonicalByName.mockReset();
    scryfallMocks.getCard.mockResolvedValue(null);
  });

  it('prefers canonical base print when multiple variants exist', async () => {
    scryfallMocks.bulkLookupByName.mockResolvedValue([trystanVariant, trystanBase]);
    scryfallMocks.lookupCanonicalByName.mockResolvedValue({
      scryfallId: 'base-id',
      setCode: 'ECL',
    });

    const result = await bulkResolveAcquisitionItems([{ name: 'Trystan', quantity: 1 }], ['ECL']);

    expect(scryfallMocks.lookupCanonicalByName).toHaveBeenCalledWith('Trystan', ['ECL']);
    expect(result.resolved).toEqual([
      {
        cachedCardId: 'base-id',
        quantity: 1,
        cachedCard: {
          scryfallId: 'base-id',
          name: 'Trystan',
          setCode: 'ECL',
          imageUris: trystanBase.imageUris,
          manaCost: '{2}{G}',
        },
      },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(prismaMock.poolAcquisition.create).not.toHaveBeenCalled();
  });

  it('uses explicitly specified set code when provided in bulk add line', async () => {
    scryfallMocks.bulkLookupByName.mockResolvedValue([trystanBase, trystanAbc]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Trystan [ABC]', quantity: 1 }], ['ECL', 'ABC']);

    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
    expect(result.resolved[0]?.cachedCardId).toBe('other-id');
    expect(result.resolved[0]?.cachedCard.name).toBe('Trystan');
    expect(result.resolved[0]?.cachedCard.setCode).toBe('ABC');
    expect(prismaMock.poolAcquisition.create).not.toHaveBeenCalled();
  });

  it('aggregates quantities for duplicate resolved card ids', async () => {
    scryfallMocks.bulkLookupByName.mockResolvedValue([lightningBolt]);

    const result = await bulkResolveAcquisitionItems(
      [
        { name: 'Lightning Bolt', quantity: 2 },
        { name: 'Lightning Bolt', quantity: 1 },
      ],
      ['ECL'],
    );

    expect(result.resolved).toEqual([
      {
        cachedCardId: 'bolt-id',
        quantity: 3,
        cachedCard: {
          scryfallId: 'bolt-id',
          name: 'Lightning Bolt',
          setCode: 'ECL',
          imageUris: lightningBolt.imageUris,
          manaCost: '{R}',
        },
      },
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it('returns empty resolved when all names are unresolved', async () => {
    scryfallMocks.bulkLookupByName.mockResolvedValue([]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Not A Real Card', quantity: 1 }], ['ECL']);

    expect(result.resolved).toEqual([]);
    expect(result.unresolved).toEqual(['Not A Real Card']);
    expect(prismaMock.poolAcquisition.create).not.toHaveBeenCalled();
  });

  it('returns mixed resolved and unresolved entries in one batch', async () => {
    scryfallMocks.bulkLookupByName.mockResolvedValue([trystanBase]);

    const result = await bulkResolveAcquisitionItems(
      [
        { name: 'Trystan', quantity: 1 },
        { name: 'Not A Real Card', quantity: 1 },
      ],
      ['ECL'],
    );

    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]?.cachedCardId).toBe('base-id');
    expect(result.unresolved).toEqual(['Not A Real Card']);
  });
});
