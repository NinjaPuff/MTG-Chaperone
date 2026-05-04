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
