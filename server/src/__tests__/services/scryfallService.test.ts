import { describe, expect, it, vi } from 'vitest';
import { createScryfallService } from '../../services/scryfallService.js';

type MockResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

function createFetchMock(responses: MockResponse[]) {
  let index = 0;
  return vi.fn(async () => {
    const next = responses[index];
    index += 1;
    if (!next) {
      throw new Error('Unexpected fetch call');
    }
    return {
      ok: next.ok,
      status: next.status,
      json: async () => next.body,
    } as Response;
  });
}

describe('scryfallService mana-cost normalization', () => {
  it('stores front-face mana cost for DFC cards when top-level mana_cost is missing', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          data: [
            {
              id: 'trystan-id',
              name: 'Trystan, Callous Cultivator // Trystan, Penitent Culler',
              layout: 'transform',
              mana_cost: null,
              type_line: 'Legendary Creature — Human',
              colors: [],
              color_identity: ['B', 'G'],
              cmc: 3,
              rarity: 'mythic',
              set: 'TST',
              collector_number: '112',
              card_faces: [
                { name: 'Trystan, Callous Cultivator', mana_cost: '{2}{G}' },
                { name: 'Trystan, Penitent Culler', mana_cost: '' },
              ],
            },
          ],
        },
      },
    ]);

    const upsert = vi.fn(async (args: any) => ({ scryfallId: args.where.scryfallId, manaCost: args.update.manaCost }));
    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      sleep: async () => {},
      prisma: {
        cachedCard: {
          upsert,
          findMany: vi.fn(async () => []),
          findUnique: vi.fn(async () => null),
        },
      } as any,
    });

    await service.searchCards('Trystan');

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.update.manaCost).toBe('{2}{G}');
    expect(call.create.manaCost).toBe('{2}{G}');
    expect(call.update.layout).toBe('transform');
    expect(call.create.layout).toBe('transform');
    expect(call.update.collectorNumber).toBe('112');
    expect(call.create.collectorNumber).toBe('112');
  });

  it('stores null layout when Scryfall card has no layout field', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          data: [
            {
              id: 'bolt-id',
              name: 'Lightning Bolt',
              type_line: 'Instant',
              rarity: 'common',
              set: 'TST',
            },
          ],
        },
      },
    ]);

    const upsert = vi.fn(async (args: any) => ({ scryfallId: args.where.scryfallId, layout: args.update.layout }));
    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      sleep: async () => {},
      prisma: {
        cachedCard: {
          upsert,
          findMany: vi.fn(async () => []),
          findUnique: vi.fn(async () => null),
        },
      } as any,
    });

    await service.searchCards('Lightning Bolt');

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.update.layout).toBeNull();
    expect(call.create.layout).toBeNull();
  });

  it('stores prepare layout when upserting prepare cards', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          data: [
            {
              id: 'joined-researchers-id',
              name: 'Joined Researchers // Secret Rendition',
              layout: 'prepare',
              type_line: 'Creature — Human Wizard',
              rarity: 'rare',
              set: 'SOS',
            },
          ],
        },
      },
    ]);

    const upsert = vi.fn(async (args: any) => ({ scryfallId: args.where.scryfallId, layout: args.update.layout }));
    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      sleep: async () => {},
      prisma: {
        cachedCard: {
          upsert,
          findMany: vi.fn(async () => []),
          findUnique: vi.fn(async () => null),
        },
      } as any,
    });

    await service.searchCards('Joined Researchers');

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.update.layout).toBe('prepare');
    expect(call.create.layout).toBe('prepare');
  });

  it('refreshes stale cached DFC rows during bulk name lookup', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          id: 'trystan-id',
          name: 'Trystan, Callous Cultivator // Trystan, Penitent Culler',
          mana_cost: null,
          type_line: 'Legendary Creature — Human',
          colors: [],
          color_identity: ['B', 'G'],
          cmc: 3,
          rarity: 'mythic',
          set: 'TST',
          card_faces: [
            { name: 'Trystan, Callous Cultivator', mana_cost: '{2}{G}' },
            { name: 'Trystan, Penitent Culler', mana_cost: '' },
          ],
        },
      },
    ]);

    const findMany = vi
      .fn(async () => [
        {
          scryfallId: 'trystan-id',
          name: 'Trystan, Callous Cultivator // Trystan, Penitent Culler',
          manaCost: null,
          cmc: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          scryfallId: 'trystan-id',
          name: 'Trystan, Callous Cultivator // Trystan, Penitent Culler',
          manaCost: null,
          cmc: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          scryfallId: 'trystan-id',
          name: 'Trystan, Callous Cultivator // Trystan, Penitent Culler',
          manaCost: '{2}{G}',
          cmc: 3,
        },
      ]);
    const upsert = vi.fn(async (args: any) => ({ scryfallId: args.where.scryfallId, manaCost: args.update.manaCost }));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      sleep: async () => {},
      prisma: {
        cachedCard: {
          upsert,
          findMany,
          findUnique: vi.fn(async () => null),
        },
      } as any,
    });

    await service.bulkLookupByName(['Trystan, Callous Cultivator // Trystan, Penitent Culler']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/cards/trystan-id');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].update.manaCost).toBe('{2}{G}');
  });
});

function makeCard(id: string, set: string) {
  return {
    id,
    name: `Card ${id}`,
    type_line: 'Creature',
    rarity: 'common',
    set,
  };
}

function setResolveResponse(code: string): MockResponse {
  return { ok: true, status: 200, body: { code: code.toLowerCase() } };
}

describe('scryfallService card cache import', () => {
  it('getSetCacheStats returns zero for sets with no cached cards', async () => {
    const count = vi.fn(async () => 0);
    const findFirst = vi.fn(async () => null);
    const service = createScryfallService({
      fetch: createFetchMock([setResolveResponse('DMU')]) as unknown as typeof fetch,
      sleep: async () => {},
      prisma: {
        cachedCard: { count, findFirst },
      } as any,
    });

    const stats = await service.getSetCacheStats(['DMU']);

    expect(stats).toEqual([{ setCode: 'DMU', cachedCount: 0, lastFetched: null }]);
    expect(count).toHaveBeenCalledWith({
      where: { setCode: { equals: 'DMU', mode: 'insensitive' } },
    });
  });

  it('getSetCacheStats returns populated counts and dates', async () => {
    const lastFetched = new Date('2026-05-31T12:00:00.000Z');
    const count = vi.fn(async () => 412);
    const findFirst = vi.fn(async () => ({ lastFetched }));
    const service = createScryfallService({
      fetch: createFetchMock([setResolveResponse('DMU')]) as unknown as typeof fetch,
      sleep: async () => {},
      prisma: {
        cachedCard: { count, findFirst },
      } as any,
    });

    const stats = await service.getSetCacheStats(['DMU']);

    expect(stats).toEqual([{ setCode: 'DMU', cachedCount: 412, lastFetched }]);
  });

  it('getSetCacheStats deduplicates input set codes', async () => {
    const count = vi.fn(async () => 0);
    const findFirst = vi.fn(async () => null);
    const fetchMock = createFetchMock([setResolveResponse('DMU')]);
    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: {
        cachedCard: { count, findFirst },
      } as any,
    });

    await service.getSetCacheStats(['dmu', 'DMU']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('getSetCacheStats resolves Scryfall set aliases such as TMNT to TMT', async () => {
    const count = vi.fn(async () => 320);
    const findFirst = vi.fn(async () => null);
    const service = createScryfallService({
      fetch: createFetchMock([setResolveResponse('TMT')]) as unknown as typeof fetch,
      sleep: async () => {},
      prisma: {
        cachedCard: { count, findFirst },
      } as any,
    });

    const stats = await service.getSetCacheStats(['TMNT']);

    expect(stats).toEqual([{ setCode: 'TMNT', cachedCount: 320, lastFetched: null }]);
    expect(count).toHaveBeenCalledWith({
      where: { setCode: { equals: 'TMT', mode: 'insensitive' } },
    });
  });

  it('importSetFromScryfall upserts cards from a single search page', async () => {
    const fetchMock = createFetchMock([
      setResolveResponse('DMU'),
      {
        ok: true,
        status: 200,
        body: {
          data: [makeCard('a', 'dmu'), makeCard('b', 'dmu'), makeCard('c', 'dmu')],
          has_more: false,
        },
      },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    const result = await service.importSetFromScryfall('DMU');

    expect(result).toEqual({ setCode: 'DMU', imported: 3, canonicalSetCode: 'DMU' });
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('set%3Admu');
    expect(fetchMock.mock.calls[1][0]).toContain('include_extras=true');
  });

  it('importSetFromScryfall paginates through next_page', async () => {
    const fetchMock = createFetchMock([
      setResolveResponse('DMU'),
      {
        ok: true,
        status: 200,
        body: {
          data: [makeCard('a', 'dmu'), makeCard('b', 'dmu')],
          has_more: true,
          next_page: 'https://api.scryfall.com/cards/search?page=2',
        },
      },
      {
        ok: true,
        status: 200,
        body: {
          data: [makeCard('c', 'dmu')],
          has_more: false,
        },
      },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    const result = await service.importSetFromScryfall('dmu');

    expect(result).toEqual({ setCode: 'DMU', imported: 3, canonicalSetCode: 'DMU' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe('https://api.scryfall.com/cards/search?page=2');
  });

  it('importSetFromScryfall resolves set aliases before searching', async () => {
    const fetchMock = createFetchMock([
      setResolveResponse('TMT'),
      {
        ok: true,
        status: 200,
        body: {
          data: [makeCard('a', 'tmt'), makeCard('b', 'tmt')],
          has_more: false,
        },
      },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    const result = await service.importSetFromScryfall('TMNT');

    expect(result).toEqual({ setCode: 'TMNT', imported: 2, canonicalSetCode: 'TMT' });
    expect(fetchMock.mock.calls[0][0]).toContain('/sets/tmnt');
    expect(fetchMock.mock.calls[1][0]).toContain('set%3Atmt');
  });

  it('importSetFromScryfall upserts reversible_card without top-level type_line', async () => {
    const fetchMock = createFetchMock([
      setResolveResponse('ECL'),
      {
        ok: true,
        status: 200,
        body: {
          data: [
            {
              id: 'ecl-blood-crypt-reversible',
              name: 'Blood Crypt // Blood Crypt',
              layout: 'reversible_card',
              rarity: 'rare',
              set: 'ecl',
              collector_number: '349',
              card_faces: [
                { type_line: 'Land — Swamp Mountain' },
                { type_line: 'Land — Swamp Mountain' },
              ],
            },
          ],
          has_more: false,
        },
      },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    const result = await service.importSetFromScryfall('ECL');

    expect(result).toEqual({ setCode: 'ECL', imported: 1, canonicalSetCode: 'ECL' });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].create.typeLine).toBe('Land — Swamp Mountain');
    expect(upsert.mock.calls[0][0].update.typeLine).toBe('Land — Swamp Mountain');
  });

  it('importSetFromScryfall throws when Scryfall returns an error', async () => {
    const fetchMock = createFetchMock([
      setResolveResponse('DMU'),
      { ok: false, status: 502, body: {} },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    await expect(service.importSetFromScryfall('DMU')).rejects.toMatchObject({
      code: 'SCRYFALL_ERROR',
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('bulkImportSet returns per-set counts and totalImported', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          data: [{ type: 'default_cards', download_uri: 'https://bulk.example/cards.json' }],
        },
      },
      {
        ok: true,
        status: 200,
        body: [makeCard('d1', 'dmu'), makeCard('d2', 'dmu'), makeCard('s1', 'stx')],
      },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    const result = await service.bulkImportSet(['DMU', 'STX']);

    expect(result).toEqual({
      results: [
        { setCode: 'DMU', imported: 2 },
        { setCode: 'STX', imported: 1 },
      ],
      totalImported: 3,
    });
    expect(upsert).toHaveBeenCalledTimes(3);
  });

  it('bulkImportSet upserts in batches instead of unbounded parallel calls', async () => {
    const cards = Array.from({ length: 75 }, (_, index) => makeCard(`id-${index}`, 'dmu'));
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          data: [{ type: 'default_cards', download_uri: 'https://bulk.example/cards.json' }],
        },
      },
      { ok: true, status: 200, body: cards },
    ]);

    let inFlight = 0;
    let maxInFlight = 0;
    const upsert = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    await service.bulkImportSet(['DMU']);

    expect(upsert).toHaveBeenCalledTimes(75);
    expect(maxInFlight).toBeLessThanOrEqual(50);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('bulkImportSet normalizes duplicate set codes', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          data: [{ type: 'default_cards', download_uri: 'https://bulk.example/cards.json' }],
        },
      },
      { ok: true, status: 200, body: [makeCard('d1', 'dmu')] },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    const result = await service.bulkImportSet([' dmu ', 'DMU']);

    expect(result.totalImported).toBe(1);
    expect(result.results).toEqual([{ setCode: 'DMU', imported: 1 }]);
  });

  it('bulkImportSet throws when default_cards bulk entry is missing', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: { data: [{ type: 'other', download_uri: 'https://bulk.example/other.json' }] },
      },
    ]);
    const upsert = vi.fn(async () => ({}));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { upsert } } as any,
    });

    await expect(service.bulkImportSet(['DMU'])).rejects.toMatchObject({
      statusCode: 500,
      code: 'SCRYFALL_ERROR',
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});

const adelineFca = {
  scryfallId: '0b9579d8-bc8f-4d74-bfc1-dcdd42568f79',
  name: 'Adeline, Resplendent Cathar',
  flavorName: 'Hero of Light',
  setCode: 'FCA',
  collectorNumber: '1',
  manaCost: '{1}{W}{W}',
  cmc: 3,
  typeLine: 'Legendary Creature — Human Knight',
  imageUris: { small: 'https://example.com/adeline.jpg' },
};

const adelineScryfallBody = {
  id: adelineFca.scryfallId,
  name: adelineFca.name,
  flavor_name: adelineFca.flavorName,
  set: 'fca',
  collector_number: '1',
  type_line: adelineFca.typeLine,
  rarity: 'rare',
  cmc: 3,
  mana_cost: '{1}{W}{W}',
};

function isFaceLookupOrQuery(orClauses: unknown) {
  if (!Array.isArray(orClauses)) {
    return false;
  }
  return orClauses.some((clause) => {
    if (typeof clause !== 'object' || !clause || !('name' in clause)) {
      return false;
    }
    const nameFilter = (clause as { name?: { startsWith?: unknown; endsWith?: unknown } }).name;
    return Boolean(nameFilter?.startsWith ?? nameFilter?.endsWith);
  });
}

describe('scryfallService bulkLookupForPoolImport', () => {
  const abigalePrepared = {
    scryfallId: 'abigale-id',
    name: 'Abigale, Poet Laureate // Heroic Stanza',
    flavorName: null,
    setCode: 'SOS',
    collectorNumber: '42',
    manaCost: '{2}{U}',
    cmc: 3,
    typeLine: 'Creature — Human',
    imageUris: { small: 'https://example.com/abigale.jpg' },
  };

  it('persists flavorName on upsert when importing a card with flavor_name', async () => {
    const fetchMock = createFetchMock([
      {
        ok: true,
        status: 200,
        body: { data: [adelineScryfallBody] },
      },
    ]);
    const upsert = vi.fn(async (args: { create: { flavorName: string | null } }) => ({
      scryfallId: adelineFca.scryfallId,
      flavorName: args.create.flavorName,
    }));

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      sleep: async () => {},
      prisma: {
        cachedCard: {
          upsert,
          findMany: vi.fn(async () => []),
          findUnique: vi.fn(async () => null),
        },
      } as never,
    });

    await service.searchCards('!"Adeline, Resplendent Cathar"');

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].create.flavorName).toBe('Hero of Light');
    expect(upsert.mock.calls[0][0].update.flavorName).toBe('Hero of Light');
  });

  it('returns card when alias is cached without calling fetch', async () => {
    const fetchMock = createFetchMock([]);
    const findMany = vi.fn(async (args: { where?: { flavorName?: unknown; OR?: unknown } }) => {
      if (args.where && 'flavorName' in args.where) {
        return [adelineFca];
      }
      if (args.where && 'OR' in args.where) {
        return [adelineFca];
      }
      return [];
    });

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { findMany, upsert: vi.fn() } } as never,
    });

    const result = await service.bulkLookupForPoolImport(['Hero of Light'], ['FCA']);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([adelineFca]);
  });

  it('returns DFC card when only the front face is queried from cache', async () => {
    const fetchMock = createFetchMock([]);
    const findMany = vi.fn(async (args: { where?: { name?: unknown; flavorName?: unknown; OR?: unknown } }) => {
      const orClauses = args.where && 'OR' in args.where ? args.where.OR : null;
      if (
        Array.isArray(orClauses) &&
        orClauses.some((clause) => typeof clause === 'object' && clause && 'name' in clause)
      ) {
        return [abigalePrepared];
      }
      return [];
    });

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { findMany, upsert: vi.fn() } } as never,
    });

    const result = await service.bulkLookupForPoolImport(['Abigale, Poet Laureate'], ['SOS']);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([abigalePrepared]);
  });

  it('returns DFC card when only the back face is queried from cache', async () => {
    const fetchMock = createFetchMock([]);
    const findMany = vi.fn(async (args: { where?: { name?: unknown; flavorName?: unknown; OR?: unknown } }) => {
      const orClauses = args.where && 'OR' in args.where ? args.where.OR : null;
      if (
        Array.isArray(orClauses) &&
        orClauses.some((clause) => typeof clause === 'object' && clause && 'name' in clause)
      ) {
        return [abigalePrepared];
      }
      return [];
    });

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { findMany, upsert: vi.fn() } } as never,
    });

    const result = await service.bulkLookupForPoolImport(['Heroic Stanza'], ['SOS']);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([abigalePrepared]);
  });

  it('does not treat partial prefixes as DFC face matches', async () => {
    const fetchMock = createFetchMock([
      { ok: false, status: 404, body: {} },
      { ok: false, status: 404, body: {} },
    ]);
    const findMany = vi.fn(async () => []);

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { findMany, upsert: vi.fn() } } as never,
    });

    const result = await service.bulkLookupForPoolImport(['Abigale'], ['SOS']);

    expect(result).toEqual([]);
  });

  it('resolves alias via named endpoint when cache is cold', async () => {
    const fetchMock = createFetchMock([
      { ok: true, status: 200, body: adelineScryfallBody },
    ]);
    const upsert = vi.fn(async () => {
      return adelineFca;
    });
    const findMany = vi.fn(async (args: { where?: { flavorName?: unknown; OR?: unknown; name?: unknown } }) => {
      if (args.where && 'name' in args.where && !('OR' in args.where)) {
        return [];
      }
      if (args.where && 'flavorName' in args.where) {
        return [];
      }
      if (args.where && 'OR' in args.where) {
        if (isFaceLookupOrQuery(args.where.OR)) {
          return [];
        }
        if (upsert.mock.calls.length === 0) {
          return [];
        }
        return [adelineFca];
      }
      return [];
    });

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { findMany, upsert } } as never,
    });

    const result = await service.bulkLookupForPoolImport(['Hero of Light'], ['FCA']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/cards/named?');
    expect(String(fetchMock.mock.calls[0][0])).toContain('set=fca');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(result[0]?.name).toBe('Adeline, Resplendent Cathar');
  });

  it('treats a name as missing when only a non-pool-set printing is cached', async () => {
    const finScryfallBody = {
      id: 'airship-fin',
      name: "Adventurer's Airship",
      set: 'fin',
      collector_number: '252',
      rarity: 'common',
      type_line: 'Artifact — Vehicle',
      cmc: 3,
    };
    const fetchMock = createFetchMock([
      { ok: false, status: 404, body: {} },
      {
        ok: true,
        status: 200,
        body: { data: [finScryfallBody] },
      },
    ]);
    const upsert = vi.fn(async () => ({
      scryfallId: 'airship-fin',
      name: "Adventurer's Airship",
      flavorName: null,
      setCode: 'FIN',
      collectorNumber: '252',
    }));
    const wrongSetOnly = {
      scryfallId: 'airship-mh2',
      name: "Adventurer's Airship",
      flavorName: null,
      setCode: 'MH2',
      collectorNumber: '99',
    };
    const finPrinting = {
      scryfallId: 'airship-fin',
      name: "Adventurer's Airship",
      flavorName: null,
      setCode: 'FIN',
      collectorNumber: '252',
    };
    const findMany = vi.fn(async (args: { where?: Record<string, unknown> }) => {
      if (args.where && 'name' in args.where && !('OR' in args.where)) {
        return [wrongSetOnly];
      }
      if (args.where && 'flavorName' in args.where) {
        return [];
      }
      if (args.where && 'OR' in args.where) {
        if (isFaceLookupOrQuery(args.where.OR)) {
          return [];
        }
        if (upsert.mock.calls.length === 0) {
          return [wrongSetOnly];
        }
        return [wrongSetOnly, finPrinting];
      }
      return [];
    });

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { findMany, upsert } } as never,
    });

    const result = await service.bulkLookupForPoolImport(["Adventurer's Airship"], ['FIN']);

    expect(fetchMock).toHaveBeenCalled();
    expect(result.some((card) => card.setCode === 'FIN')).toBe(true);
  });

  it('tries pool set codes in order for named lookup', async () => {
    const fetchMock = createFetchMock([
      { ok: false, status: 404, body: {} },
      { ok: true, status: 200, body: adelineScryfallBody },
    ]);
    const upsert = vi.fn(async () => adelineFca);
    const findMany = vi.fn().mockResolvedValue([]);

    const service = createScryfallService({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      prisma: { cachedCard: { findMany, upsert } } as never,
    });

    await service.bulkLookupForPoolImport(['Hero of Light'], ['ECL', 'FCA']);

    expect(String(fetchMock.mock.calls[0][0])).toContain('set=ecl');
    expect(String(fetchMock.mock.calls[1][0])).toContain('set=fca');
  });
});
