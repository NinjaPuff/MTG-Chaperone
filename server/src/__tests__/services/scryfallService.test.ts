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
    expect(call.update.collectorNumber).toBe('112');
    expect(call.create.collectorNumber).toBe('112');
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
