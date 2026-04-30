import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';

type ScryfallSet = {
  code: string;
  name: string;
  icon_svg_uri: string | null;
  set_type: string;
  released_at: string | null;
};

type CachedSets = {
  expiresAt: number;
  data: ScryfallSet[];
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const EXCLUDED_SET_TYPES = new Set(['token', 'memorabilia', 'vanguard', 'planar', 'minigame']);

let cache: CachedSets | null = null;

async function fetchScryfallSets() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.data;
  }

  const response = await fetch('https://api.scryfall.com/sets', {
    headers: {
      'User-Agent': 'MtgBoxLeagueHelper/0.1',
    },
  });

  if (!response.ok) {
    throw new AppError(502, 'SCRYFALL_UNAVAILABLE', `Unable to fetch Scryfall sets (${response.status})`);
  }

  const payload = (await response.json()) as { data?: ScryfallSet[] };
  const filtered = (payload.data ?? []).filter((set) => !EXCLUDED_SET_TYPES.has(set.set_type));

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    data: filtered,
  };

  return filtered;
}

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await fetchScryfallSets();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { router as setsRouter };
