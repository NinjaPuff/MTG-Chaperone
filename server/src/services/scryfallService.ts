import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const SCRYFALL_BASE_URL = 'https://api.scryfall.com';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RATE_LIMIT_MS = 120;
const UPSERT_BATCH_SIZE = 50;

function normalizeSetCodes(setCodes: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const code of setCodes) {
    const upper = code.trim().toUpperCase();
    if (!upper || seen.has(upper)) {
      continue;
    }
    seen.add(upper);
    normalized.push(upper);
  }

  return normalized.sort((a, b) => a.localeCompare(b));
}

type ScryfallCard = {
  id: string;
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  cmc?: number;
  rarity: string;
  set: string;
  image_uris?: Record<string, string>;
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    image_uris?: Record<string, string>;
  }>;
  prices?: Record<string, string | null>;
};

function resolveManaCost(card: ScryfallCard) {
  const topLevel = card.mana_cost?.trim();
  if (topLevel) {
    return topLevel;
  }

  if (card.card_faces) {
    for (const face of card.card_faces) {
      const faceCost = face.mana_cost?.trim();
      if (faceCost) {
        return faceCost;
      }
    }
  }

  return null;
}

function resolveImageUris(card: ScryfallCard) {
  if (card.image_uris) {
    return card.image_uris;
  }

  if (card.card_faces) {
    for (const face of card.card_faces) {
      if (face.image_uris) {
        return face.image_uris;
      }
    }
  }

  return Prisma.JsonNull;
}

type ScryfallDeps = {
  prisma: PrismaClient;
  fetch: typeof fetch;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
};

export function createScryfallService(partialDeps?: Partial<ScryfallDeps>) {
  const deps: ScryfallDeps = {
    prisma,
    fetch: fetch.bind(globalThis),
    now: () => new Date(),
    sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    ...partialDeps,
  };

  let rateLimiter = Promise.resolve();

  async function withRateLimit<T>(task: () => Promise<T>) {
    const next = rateLimiter.then(() => deps.sleep(RATE_LIMIT_MS));
    rateLimiter = next.catch(() => Promise.resolve());
    await next;
    return task();
  }

  async function fetchScryfall<T>(url: string): Promise<T> {
    return withRateLimit(async () => {
      const response = await deps.fetch(url, {
        headers: {
          'User-Agent': 'MtgChaperone/0.1',
        },
      });
      if (!response.ok) {
        throw new AppError(response.status, 'SCRYFALL_ERROR', `Scryfall request failed: ${response.status}`);
      }
      return (await response.json()) as T;
    });
  }

  function buildSetClause(setCodes: string[]) {
    const normalizedSets = setCodes.map((setCode) => setCode.trim().toLowerCase()).filter(Boolean);
    return normalizedSets.length ? ` (${normalizedSets.map((setCode) => `set:${setCode}`).join(' OR ')})` : '';
  }

  async function resolveCanonicalSetCode(setCode: string) {
    const trimmed = setCode.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const set = await fetchScryfall<{ code: string }>(
        `${SCRYFALL_BASE_URL}/sets/${encodeURIComponent(trimmed.toLowerCase())}`,
      );
      return set.code.toUpperCase();
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return trimmed.toUpperCase();
      }
      throw error;
    }
  }

  function buildSetImportSearchUrl(canonicalSetCode: string) {
    const query = encodeURIComponent(`set:${canonicalSetCode.toLowerCase()}`);
    return `${SCRYFALL_BASE_URL}/cards/search?q=${query}&unique=prints&include_extras=true&include_variations=true`;
  }

  async function countCachedCardsForSet(canonicalSetCode: string) {
    return deps.prisma.cachedCard.count({
      where: { setCode: { equals: canonicalSetCode, mode: 'insensitive' } },
    });
  }

  async function latestCachedFetchForSet(canonicalSetCode: string) {
    return deps.prisma.cachedCard.findFirst({
      where: { setCode: { equals: canonicalSetCode, mode: 'insensitive' } },
      orderBy: { lastFetched: 'desc' },
      select: { lastFetched: true },
    });
  }

  async function upsertCard(card: ScryfallCard) {
    const manaCost = resolveManaCost(card);
    return deps.prisma.cachedCard.upsert({
    where: { scryfallId: card.id },
    update: {
      name: card.name,
      manaCost,
      typeLine: card.type_line,
      oracleText: card.oracle_text ?? null,
      colors: card.colors ?? [],
      colorIdentity: card.color_identity ?? [],
      cmc: card.cmc ?? 0,
      rarity: card.rarity,
      setCode: card.set.toUpperCase(),
      imageUris: resolveImageUris(card),
      prices: card.prices ?? Prisma.JsonNull,
      lastFetched: deps.now(),
    },
    create: {
      scryfallId: card.id,
      name: card.name,
      manaCost,
      typeLine: card.type_line,
      oracleText: card.oracle_text ?? null,
      colors: card.colors ?? [],
      colorIdentity: card.color_identity ?? [],
      cmc: card.cmc ?? 0,
      rarity: card.rarity,
      setCode: card.set.toUpperCase(),
      imageUris: resolveImageUris(card),
      prices: card.prices ?? Prisma.JsonNull,
      lastFetched: deps.now(),
    },
  });
  }

  async function upsertCardsInBatches(cards: ScryfallCard[]) {
    for (let index = 0; index < cards.length; index += UPSERT_BATCH_SIZE) {
      const batch = cards.slice(index, index + UPSERT_BATCH_SIZE);
      await Promise.all(batch.map((card) => upsertCard(card)));
    }
  }

  async function getSetCacheStats(setCodes: string[]) {
    const normalized = normalizeSetCodes(setCodes);
    if (normalized.length === 0) {
      return [];
    }

    return Promise.all(
      normalized.map(async (requestedCode) => {
        const canonicalSetCode = await resolveCanonicalSetCode(requestedCode);
        const [cachedCount, latest] = await Promise.all([
          countCachedCardsForSet(canonicalSetCode),
          latestCachedFetchForSet(canonicalSetCode),
        ]);

        return {
          setCode: requestedCode,
          cachedCount,
          lastFetched: latest?.lastFetched ?? null,
        };
      }),
    );
  }

  async function importSetFromScryfall(setCode: string) {
    const requestedCode = setCode.trim().toUpperCase();
    if (!requestedCode) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Set code is required');
    }

    const canonicalSetCode = await resolveCanonicalSetCode(setCode);

    let imported = 0;
    let nextUrl: string | null = buildSetImportSearchUrl(canonicalSetCode);

    while (nextUrl) {
      const response = await fetchScryfall<{
        data: ScryfallCard[];
        has_more: boolean;
        next_page?: string;
      }>(nextUrl);

      const cards = response.data ?? [];
      if (cards.length > 0) {
        await upsertCardsInBatches(cards);
        imported += cards.length;
      }

      nextUrl = response.has_more && response.next_page ? response.next_page : null;
    }

    return { setCode: requestedCode, imported, canonicalSetCode };
  }

  async function searchCards(query: string, setCodes: string[] = []) {
    const setClause = buildSetClause(setCodes);
    const scryfallQuery = `${query}${setClause}`.trim();
    const encodedQuery = encodeURIComponent(scryfallQuery);

    const response = await fetchScryfall<{ data: ScryfallCard[] }>(
      `${SCRYFALL_BASE_URL}/cards/search?q=${encodedQuery}&order=name&unique=prints`,
    );

    const cards = await Promise.all(response.data.map((card) => upsertCard(card)));
    return cards;
  }

  async function lookupCanonicalByName(name: string, setCodes: string[] = []) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return null;
    }

    const setClause = buildSetClause(setCodes);
    const scryfallQuery = `!"${trimmedName}"${setClause}`.trim();
    const encodedQuery = encodeURIComponent(scryfallQuery);
    const response = await fetchScryfall<{ data: ScryfallCard[] }>(
      `${SCRYFALL_BASE_URL}/cards/search?q=${encodedQuery}&order=name&unique=cards`,
    );

    const canonical = response.data[0];
    if (!canonical) {
      return null;
    }

    return upsertCard(canonical);
  }

  async function getCard(scryfallId: string) {
    const cached = await deps.prisma.cachedCard.findUnique({ where: { scryfallId } });
    if (cached && deps.now().getTime() - cached.lastFetched.getTime() <= CACHE_TTL_MS) {
      return cached;
    }

    const card = await fetchScryfall<ScryfallCard>(`${SCRYFALL_BASE_URL}/cards/${scryfallId}`);
    return upsertCard(card);
  }

  async function getCardFaces(scryfallId: string) {
    const card = await fetchScryfall<ScryfallCard>(`${SCRYFALL_BASE_URL}/cards/${scryfallId}`);

    if (card.card_faces && card.card_faces.length > 1) {
      return card.card_faces.map((face) => ({
        name: face.name ?? card.name,
        imageUris: face.image_uris ?? null,
      }));
    }

    return [
      {
        name: card.name,
        imageUris: card.image_uris ?? null,
      },
    ];
  }

  async function bulkLookupByName(names: string[]) {
    const normalizedNames = names.map((name) => name.trim()).filter(Boolean);
    if (normalizedNames.length === 0) {
      return [];
    }

    const cached = await deps.prisma.cachedCard.findMany({
      where: {
        name: {
          in: normalizedNames,
          mode: 'insensitive',
        },
      },
    });

    const missing = normalizedNames.filter(
      (name) => !cached.some((card) => card.name.toLowerCase() === name.toLowerCase()),
    );

    const staleDoubleFacedIds = [...new Set(
      cached
        .filter((card) => card.manaCost === null && card.cmc > 0 && card.name.includes('//'))
        .map((card) => card.scryfallId),
    )];

    for (const name of missing) {
      try {
        await searchCards(`!"${name}"`);
      } catch {
        // Ignore unresolved names in bulk mode.
      }
    }

    for (const scryfallId of staleDoubleFacedIds) {
      try {
        const card = await fetchScryfall<ScryfallCard>(`${SCRYFALL_BASE_URL}/cards/${scryfallId}`);
        await upsertCard(card);
      } catch {
        // Ignore refresh failures and preserve current cache row.
      }
    }

    return deps.prisma.cachedCard.findMany({
      where: {
        name: {
          in: normalizedNames,
          mode: 'insensitive',
        },
      },
    });
  }

  async function bulkImportSet(setCodes: string[]) {
    const normalized = normalizeSetCodes(setCodes);
    if (normalized.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'At least one set code is required');
    }

    const response = await fetchScryfall<{
      data: Array<{
        type: string;
        download_uri: string;
      }>;
    }>(`${SCRYFALL_BASE_URL}/bulk-data`);

    const defaultCards = response.data.find((item) => item.type === 'default_cards');
    if (!defaultCards) {
      throw new AppError(500, 'SCRYFALL_ERROR', 'Unable to find Scryfall default bulk data');
    }

    const cards = await fetchScryfall<ScryfallCard[]>(defaultCards.download_uri);
    const normalizedLower = new Set(normalized.map((code) => code.toLowerCase()));
    const filtered = cards.filter((card) => normalizedLower.has(card.set.toLowerCase()));

    const importedBySet = new Map<string, number>(normalized.map((code) => [code, 0]));
    for (const card of filtered) {
      const setCode = card.set.toUpperCase();
      importedBySet.set(setCode, (importedBySet.get(setCode) ?? 0) + 1);
    }

    await upsertCardsInBatches(filtered);

    const results = normalized.map((setCode) => ({
      setCode,
      imported: importedBySet.get(setCode) ?? 0,
    }));

    return {
      results,
      totalImported: filtered.length,
    };
  }

  return {
    searchCards,
    lookupCanonicalByName,
    getCard,
    getCardFaces,
    bulkLookupByName,
    bulkImportSet,
    importSetFromScryfall,
    getSetCacheStats,
  };
}

const defaultScryfallService = createScryfallService();
export const searchCards = defaultScryfallService.searchCards;
export const lookupCanonicalByName = defaultScryfallService.lookupCanonicalByName;
export const getCard = defaultScryfallService.getCard;
export const getCardFaces = defaultScryfallService.getCardFaces;
export const bulkLookupByName = defaultScryfallService.bulkLookupByName;
export const bulkImportSet = defaultScryfallService.bulkImportSet;
export const importSetFromScryfall = defaultScryfallService.importSetFromScryfall;
export const getSetCacheStats = defaultScryfallService.getSetCacheStats;
