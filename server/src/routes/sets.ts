import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import type { AppDeps } from '../di/types.js';

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

async function fetchScryfallSets(httpFetch: typeof fetch, now: number) {
  if (cache && cache.expiresAt > now) {
    return cache.data;
  }

  const response = await httpFetch('https://api.scryfall.com/sets', {
    headers: {
      'User-Agent': 'MtgChaperone/0.1',
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

export function createSetsRouter(deps?: Pick<AppDeps, 'http' | 'clock'>) {
  const router = Router();
  const httpFetch = deps?.http.fetch ?? fetch;
  const getNow = () => (deps?.clock.now() ?? new Date()).getTime();

  router.get('/', async (_req, res, next) => {
    try {
      const data = await fetchScryfallSets(httpFetch, getNow());
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const setsRouter = createSetsRouter();
