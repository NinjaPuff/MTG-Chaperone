import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

const SCRYFALL_BASE_URL = 'https://api.scryfall.com';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RATE_LIMIT_MS = 120;

let rateLimiter = Promise.resolve();

async function withRateLimit<T>(task: () => Promise<T>) {
  const next = rateLimiter.then(() => new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS)));
  rateLimiter = next.catch(() => Promise.resolve());
  await next;
  return task();
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
  prices?: Record<string, string | null>;
};

async function fetchScryfall<T>(url: string): Promise<T> {
  return withRateLimit(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MtgBoxLeagueHelper/0.1',
      },
    });
    if (!response.ok) {
      throw new AppError(response.status, 'SCRYFALL_ERROR', `Scryfall request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  });
}

async function upsertCard(card: ScryfallCard) {
  return prisma.cachedCard.upsert({
    where: { scryfallId: card.id },
    update: {
      name: card.name,
      manaCost: card.mana_cost ?? null,
      typeLine: card.type_line,
      oracleText: card.oracle_text ?? null,
      colors: card.colors ?? [],
      colorIdentity: card.color_identity ?? [],
      cmc: card.cmc ?? 0,
      rarity: card.rarity,
      setCode: card.set.toUpperCase(),
      imageUris: card.image_uris ?? Prisma.JsonNull,
      prices: card.prices ?? Prisma.JsonNull,
      lastFetched: new Date(),
    },
    create: {
      scryfallId: card.id,
      name: card.name,
      manaCost: card.mana_cost ?? null,
      typeLine: card.type_line,
      oracleText: card.oracle_text ?? null,
      colors: card.colors ?? [],
      colorIdentity: card.color_identity ?? [],
      cmc: card.cmc ?? 0,
      rarity: card.rarity,
      setCode: card.set.toUpperCase(),
      imageUris: card.image_uris ?? Prisma.JsonNull,
      prices: card.prices ?? Prisma.JsonNull,
      lastFetched: new Date(),
    },
  });
}

export async function searchCards(query: string, setCodes: string[] = []) {
  const normalizedSets = setCodes.map((setCode) => setCode.trim().toLowerCase()).filter(Boolean);
  const setClause = normalizedSets.length
    ? ` (${normalizedSets.map((setCode) => `set:${setCode}`).join(' OR ')})`
    : '';
  const scryfallQuery = `${query}${setClause}`.trim();
  const encodedQuery = encodeURIComponent(scryfallQuery);

  const response = await fetchScryfall<{ data: ScryfallCard[] }>(
    `${SCRYFALL_BASE_URL}/cards/search?q=${encodedQuery}&order=name&unique=prints`,
  );

  const cards = await Promise.all(response.data.map((card) => upsertCard(card)));
  return cards;
}

export async function getCard(scryfallId: string) {
  const cached = await prisma.cachedCard.findUnique({ where: { scryfallId } });
  if (cached && Date.now() - cached.lastFetched.getTime() <= CACHE_TTL_MS) {
    return cached;
  }

  const card = await fetchScryfall<ScryfallCard>(`${SCRYFALL_BASE_URL}/cards/${scryfallId}`);
  return upsertCard(card);
}

export async function bulkLookupByName(names: string[]) {
  const normalizedNames = names.map((name) => name.trim()).filter(Boolean);
  if (normalizedNames.length === 0) {
    return [];
  }

  const cached = await prisma.cachedCard.findMany({
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

  for (const name of missing) {
    try {
      await searchCards(`!"${name}"`);
    } catch {
      // Ignore unresolved names in bulk mode.
    }
  }

  return prisma.cachedCard.findMany({
    where: {
      name: {
        in: normalizedNames,
        mode: 'insensitive',
      },
    },
  });
}

export async function bulkImportSet(setCodes: string[]) {
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
