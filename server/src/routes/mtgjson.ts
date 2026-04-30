import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

type BoosterMap = Record<string, string[]>;

type CachedBoosterData = {
  expiresAt: number;
  data: BoosterMap;
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const cache = new Map<string, CachedBoosterData>();

function normalizeSetCodes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

async function fetchBoosterData(setCode: string) {
  const normalizedSetCode = setCode.trim().toUpperCase();
  const now = Date.now();
  const cached = cache.get(normalizedSetCode);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const response = await fetch(`https://mtgjson.com/api/v5/${normalizedSetCode}.json`, {
    headers: {
      'User-Agent': 'MtgBoxLeagueHelper/0.1',
    },
  });

  if (!response.ok) {
    throw new AppError(502, 'MTGJSON_UNAVAILABLE', `Unable to fetch MTGJSON set data (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: {
      booster?: Record<string, { sourceSetCodes?: unknown }>;
    };
  };

  const booster = payload.data?.booster;
  if (!booster || typeof booster !== 'object') {
    return {};
  }

  const extracted = Object.entries(booster).reduce<BoosterMap>((accumulator, [boosterType, config]) => {
    const sourceSetCodes = normalizeSetCodes(config?.sourceSetCodes);
    if (sourceSetCodes.length > 0) {
      accumulator[boosterType] = sourceSetCodes;
    }
    return accumulator;
  }, {});

  cache.set(normalizedSetCode, {
    expiresAt: now + CACHE_TTL_MS,
    data: extracted,
  });

  return extracted;
}

const router = Router();

router.get('/:setCode/boosters', requireAuth, async (req, res, next) => {
  try {
    const data = await fetchBoosterData(req.params.setCode);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { router as mtgjsonRouter };
