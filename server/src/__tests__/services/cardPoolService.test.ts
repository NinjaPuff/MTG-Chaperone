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
  bulkLookupForPoolImport: vi.fn(),
  getCard: vi.fn(),
  lookupCanonicalByName: vi.fn(),
  tryResolvePrintingInPoolSet: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../services/scryfallService.js', () => ({
  bulkLookupForPoolImport: scryfallMocks.bulkLookupForPoolImport,
  getCard: scryfallMocks.getCard,
  lookupCanonicalByName: scryfallMocks.lookupCanonicalByName,
  tryResolvePrintingInPoolSet: scryfallMocks.tryResolvePrintingInPoolSet,
}));

import {
  bulkResolveAcquisitionItems,
  filterBulkResolveCandidates,
} from '../../services/cardPoolService.js';
import { formatDecklistLine } from '@mtg-league/shared';

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

const adelineFca = {
  scryfallId: '0b9579d8-bc8f-4d74-bfc1-dcdd42568f79',
  name: 'Adeline, Resplendent Cathar',
  flavorName: 'Hero of Light',
  setCode: 'FCA',
  collectorNumber: '1',
  imageUris: { small: 'https://example.com/adeline.jpg' },
  manaCost: '{1}{W}{W}',
};

const trystanCanonical = 'Trystan, Callous Cultivator // Trystan, Penitent Culler';
const trystanMisexport = 'Trystan, Callous Cultivator / Trystan, Penitent Culler';
const trystanPasteLine = 'Trystan, Callous Cultivator / Trystan, Penitent Culler (TST) 112';

const trystanDfcCached = {
  scryfallId: 'trystan-id',
  name: trystanCanonical,
  setCode: 'TST',
  collectorNumber: '112',
  imageUris: { small: 'https://example.com/trystan.jpg' },
  manaCost: '{2}{G}',
};

describe('cardPoolService bulkResolveAcquisitionItems', () => {
  beforeEach(() => {
    prismaMock.cachedCard.findMany.mockReset();
    prismaMock.poolAcquisition.create.mockReset();
    scryfallMocks.bulkLookupForPoolImport.mockReset();
    scryfallMocks.getCard.mockReset();
    scryfallMocks.lookupCanonicalByName.mockReset();
    scryfallMocks.tryResolvePrintingInPoolSet.mockReset();
    scryfallMocks.tryResolvePrintingInPoolSet.mockResolvedValue(null);
    scryfallMocks.getCard.mockResolvedValue(null);
  });

  it('matches set printing when collector number is missing from cache', () => {
    const allowed = new Set(['FIN']);
    const candidates = filterBulkResolveCandidates(
      [
        {
          scryfallId: 'airship-fin',
          name: "Adventurer's Airship",
          setCode: 'FIN',
          collectorNumber: null,
          imageUris: null,
          manaCost: '{2}',
        },
      ],
      'FIN',
      '252',
      allowed,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.scryfallId).toBe('airship-fin');
  });

  it('fetches pool-set printing when cache only has a different set', async () => {
    const wrongSetPrinting = {
      scryfallId: 'airship-mh2',
      name: "Adventurer's Airship",
      setCode: 'MH2',
      collectorNumber: '99',
      imageUris: { small: 'https://example.com/wrong.jpg' },
      manaCost: '{2}',
    };
    const finPrinting = {
      scryfallId: 'airship-fin',
      name: "Adventurer's Airship",
      flavorName: null,
      setCode: 'FIN',
      collectorNumber: '252',
      imageUris: { small: 'https://example.com/fin.jpg' },
      manaCost: '{2}',
    };

    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([wrongSetPrinting]);
    scryfallMocks.tryResolvePrintingInPoolSet.mockResolvedValue(finPrinting);

    const result = await bulkResolveAcquisitionItems(
      [{ name: "Adventurer's Airship (FIN) 252", quantity: 2 }],
      ['FIN'],
    );

    expect(scryfallMocks.tryResolvePrintingInPoolSet).toHaveBeenCalledWith(
      "Adventurer's Airship",
      'FIN',
      '252',
      ['FIN'],
    );
    expect(result.resolved).toEqual([
      {
        cachedCardId: 'airship-fin',
        quantity: 2,
        cachedCard: {
          scryfallId: 'airship-fin',
          name: "Adventurer's Airship",
          flavorName: null,
          setCode: 'FIN',
          imageUris: finPrinting.imageUris,
          manaCost: '{2}',
        },
      },
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it('prefers canonical base print when multiple variants exist', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([trystanVariant, trystanBase]);
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
          flavorName: null,
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
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([trystanBase, trystanAbc]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Trystan [ABC]', quantity: 1 }], ['ECL', 'ABC']);

    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
    expect(result.resolved[0]?.cachedCardId).toBe('other-id');
    expect(result.resolved[0]?.cachedCard.name).toBe('Trystan');
    expect(result.resolved[0]?.cachedCard.setCode).toBe('ABC');
    expect(prismaMock.poolAcquisition.create).not.toHaveBeenCalled();
  });

  it('aggregates quantities for duplicate resolved card ids', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([lightningBolt]);

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
          flavorName: null,
          setCode: 'ECL',
          imageUris: lightningBolt.imageUris,
          manaCost: '{R}',
        },
      },
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it('returns empty resolved when all names are unresolved', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Not A Real Card', quantity: 1 }], ['ECL']);

    expect(result.resolved).toEqual([]);
    expect(result.unresolved).toEqual(['Not A Real Card']);
    expect(prismaMock.poolAcquisition.create).not.toHaveBeenCalled();
  });

  it('returns mixed resolved and unresolved entries in one batch', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([trystanBase]);

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

  it('resolves parenthetical set syntax', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([trystanAbc]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Trystan (ABC)', quantity: 1 }], ['ECL', 'ABC']);

    expect(result.resolved[0]?.cachedCardId).toBe('other-id');
    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
  });

  it('matches collector number when multiple printings share a set', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([
      { ...lightningBolt, scryfallId: 'bolt-112', collectorNumber: '112' },
      { ...lightningBolt, scryfallId: 'bolt-113', collectorNumber: '113' },
    ]);

    const result = await bulkResolveAcquisitionItems(
      [{ name: 'Lightning Bolt (ECL) 113', quantity: 1 }],
      ['ECL'],
    );

    expect(result.resolved[0]?.cachedCardId).toBe('bolt-113');
    expect(result.unresolved).toEqual([]);
  });

  it('marks lines unresolved when collector number does not match', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([
      { ...lightningBolt, scryfallId: 'bolt-112', collectorNumber: '112' },
    ]);

    const result = await bulkResolveAcquisitionItems(
      [{ name: 'Lightning Bolt (ECL) 999', quantity: 1 }],
      ['ECL'],
    );

    expect(result.resolved).toEqual([]);
    expect(result.unresolved).toEqual(['Lightning Bolt (ECL) 999']);
  });

  it('round-trips exported decklist lines through bulk resolve', async () => {
    const exportedLine = formatDecklistLine({
      quantity: 2,
      name: 'Lightning Bolt',
      setCode: 'ECL',
      collectorNumber: '112',
    });
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([
      { ...lightningBolt, scryfallId: 'bolt-112', collectorNumber: '112' },
    ]);

    const result = await bulkResolveAcquisitionItems(
      [{ name: exportedLine.replace(/^\d+\s+/, ''), quantity: 2 }],
      ['ECL'],
    );

    expect(result.resolved[0]?.cachedCardId).toBe('bolt-112');
    expect(result.resolved[0]?.quantity).toBe(2);
  });

  it('resolves by oracle name when another cached card shares that text as flavorName', async () => {
    const decoyWithFlavorBolt = {
      scryfallId: 'decoy-id',
      name: 'Decoy Planeswalker',
      flavorName: 'Lightning Bolt',
      setCode: 'AAA',
      imageUris: { small: 'https://example.com/decoy.jpg' },
      manaCost: '{3}',
    };

    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([decoyWithFlavorBolt, lightningBolt]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Lightning Bolt', quantity: 1 }], ['ECL', 'AAA']);

    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]?.cachedCardId).toBe('bolt-id');
    expect(result.unresolved).toEqual([]);
  });

  it('resolves FCA flavor alias to canonical card', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([adelineFca]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Hero of Light (FCA)', quantity: 2 }], ['FCA']);

    expect(scryfallMocks.bulkLookupForPoolImport).toHaveBeenCalledWith(['Hero of Light'], ['FCA']);
    expect(result.resolved).toEqual([
      {
        cachedCardId: adelineFca.scryfallId,
        quantity: 2,
        cachedCard: {
          scryfallId: adelineFca.scryfallId,
          name: 'Adeline, Resplendent Cathar',
          flavorName: 'Hero of Light',
          setCode: 'FCA',
          imageUris: adelineFca.imageUris,
          manaCost: '{1}{W}{W}',
        },
      },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
  });

  it('aggregates duplicate alias lines', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([adelineFca]);

    const result = await bulkResolveAcquisitionItems(
      [
        { name: 'Hero of Light (FCA)', quantity: 2 },
        { name: 'Hero of Light (FCA)', quantity: 1 },
      ],
      ['FCA'],
    );

    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]?.quantity).toBe(3);
    expect(result.resolved[0]?.cachedCard.name).toBe('Adeline, Resplendent Cathar');
  });

  it('resolves flavor alias case-insensitively', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([adelineFca]);

    const result = await bulkResolveAcquisitionItems([{ name: 'hero of light (fca)', quantity: 1 }], ['FCA']);

    expect(result.resolved[0]?.cachedCard.name).toBe('Adeline, Resplendent Cathar');
    expect(result.unresolved).toEqual([]);
  });

  it('keeps alias unresolved when set is outside pool allowed sets', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([adelineFca]);

    const result = await bulkResolveAcquisitionItems([{ name: 'Hero of Light (FCA)', quantity: 1 }], ['ECL']);

    expect(result.resolved).toEqual([]);
    expect(result.unresolved).toEqual(['Hero of Light (FCA)']);
    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
  });

  it('resolves single-slash DFC to canonical name', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([trystanDfcCached]);

    const result = await bulkResolveAcquisitionItems([{ name: trystanPasteLine, quantity: 1 }], ['TST']);

    expect(scryfallMocks.bulkLookupForPoolImport).toHaveBeenCalledWith(
      expect.arrayContaining([trystanMisexport, trystanCanonical]),
      ['TST'],
    );
    expect(result.resolved[0]?.cachedCard.name).toBe(trystanCanonical);
    expect(result.unresolved).toEqual([]);
    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
  });

  it('passes parsed DFC name without set suffix to bulk lookup', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([trystanDfcCached]);

    await bulkResolveAcquisitionItems([{ name: trystanPasteLine, quantity: 1 }], ['TST']);

    const lookupNames = scryfallMocks.bulkLookupForPoolImport.mock.calls[0]?.[0] as string[];
    expect(lookupNames).toEqual(expect.arrayContaining([trystanMisexport]));
    expect(lookupNames.every((name) => !name.includes('(TST)') && !name.endsWith('112'))).toBe(true);
  });

  it('keeps single-slash DFC unresolved when set is outside pool allowed sets', async () => {
    scryfallMocks.bulkLookupForPoolImport.mockResolvedValue([trystanDfcCached]);

    const result = await bulkResolveAcquisitionItems([{ name: trystanPasteLine, quantity: 1 }], ['ECL']);

    expect(result.resolved).toEqual([]);
    expect(result.unresolved).toEqual([trystanPasteLine]);
    expect(scryfallMocks.lookupCanonicalByName).not.toHaveBeenCalled();
  });
});
