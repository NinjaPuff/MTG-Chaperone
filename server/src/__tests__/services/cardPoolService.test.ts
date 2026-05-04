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

import { bulkCreateAcquisition } from '../../services/cardPoolService.js';

describe('cardPoolService bulkCreateAcquisition', () => {
  beforeEach(() => {
    prismaMock.cachedCard.findMany.mockReset();
    prismaMock.poolAcquisition.create.mockReset();
    scryfallMocks.bulkLookupByName.mockReset();
    scryfallMocks.getCard.mockReset();
    scryfallMocks.lookupCanonicalByName.mockReset();
    scryfallMocks.getCard.mockResolvedValue(null);
  });

  it('prefers canonical base print when multiple variants exist', async () => {
    scryfallMocks.bulkLookupByName.mockResolvedValue([
      { scryfallId: 'variant-id', name: 'Trystan', setCode: 'ECL' },
      { scryfallId: 'base-id', name: 'Trystan', setCode: 'ECL' },
    ]);
    scryfallMocks.lookupCanonicalByName.mockResolvedValue({
      scryfallId: 'base-id',
      setCode: 'ECL',
    });
    prismaMock.cachedCard.findMany.mockResolvedValue([{ scryfallId: 'base-id' }]);
    prismaMock.poolAcquisition.create.mockResolvedValue({
      id: 'acq-1',
      entries: [{ cachedCard: { scryfallId: 'base-id' }, quantity: 1 }],
    });

    await bulkCreateAcquisition(
      'pool-1',
      'Initial Pool',
      [{ name: 'Trystan', quantity: 1 }],
      ['ECL'],
    );

    expect(scryfallMocks.lookupCanonicalByName).toHaveBeenCalledWith('Trystan', ['ECL']);
    expect(prismaMock.poolAcquisition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entries: {
            create: [{ cachedCardId: 'base-id', quantity: 1 }],
          },
        }),
      }),
    );
  });

  it('uses explicitly specified set code when provided in bulk add line', async () => {
    scryfallMocks.bulkLookupByName.mockResolvedValue([
      { scryfallId: 'base-id', name: 'Trystan', setCode: 'ECL' },
      { scryfallId: 'other-id', name: 'Trystan', setCode: 'ABC' },
    ]);
    prismaMock.cachedCard.findMany.mockResolvedValue([{ scryfallId: 'other-id' }]);
    prismaMock.poolAcquisition.create.mockResolvedValue({
      id: 'acq-1',
      entries: [{ cachedCard: { scryfallId: 'other-id' }, quantity: 1 }],
    });

    await bulkCreateAcquisition(
      'pool-1',
      'Initial Pool',
      [{ name: 'Trystan [ABC]', quantity: 1 }],
      ['ECL', 'ABC'],
    );

    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
    expect(prismaMock.poolAcquisition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entries: {
            create: [{ cachedCardId: 'other-id', quantity: 1 }],
          },
        }),
      }),
    );
  });
});
