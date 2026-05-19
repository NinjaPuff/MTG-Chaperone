import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const SCRYFALL_BASE_URL = 'https://api.scryfall.com';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RATE_LIMIT_MS = 120;

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
    const normalizedSetCodes = setCodes.map((code) => code.trim().toLowerCase());
    const filtered = cards.filter((card) => normalizedSetCodes.includes(card.set.toLowerCase()));
    await Promise.all(filtered.map((card) => upsertCard(card)));
    return { imported: filtered.length };
  }

  return {
    searchCards,
    lookupCanonicalByName,
    getCard,
    getCardFaces,
    bulkLookupByName,
    bulkImportSet,
  };
}

const defaultScryfallService = createScryfallService();
export const searchCards = defaultScryfallService.searchCards;
export const lookupCanonicalByName = defaultScryfallService.lookupCanonicalByName;
export const getCard = defaultScryfallService.getCard;
export const getCardFaces = defaultScryfallService.getCardFaces;
export const bulkLookupByName = defaultScryfallService.bulkLookupByName;
export const bulkImportSet = defaultScryfallService.bulkImportSet;
