import { useEffect, useState } from 'react';
import { resolvePrimarySetCode } from '@mtg-league/shared';
import { apiRequest } from '@/lib/api';
import { normalizeSetCode } from '@/lib/setSymbol';

type PoolSetCode = { id: string; setCode: string };

export type PoolSetInfo = {
  setCodes: string[];
  primarySetCode: string | null;
};

type SeasonPool = {
  user: { id: string };
  boosterProduct: {
    primarySetCode?: string | null;
    setCodes: PoolSetCode[];
  };
};

type ApiListResponse<T> = { data: T[] };

function buildPoolSetsMap(pools: SeasonPool[]): Map<string, PoolSetInfo> {
  const map = new Map<string, PoolSetInfo>();

  for (const pool of pools) {
    const seen = new Set<string>();
    const codes: string[] = [];
    for (const entry of pool.boosterProduct.setCodes) {
      const normalized = normalizeSetCode(entry.setCode);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      codes.push(normalized);
    }

    codes.sort((a, b) => a.localeCompare(b));
    map.set(pool.user.id, {
      setCodes: codes,
      primarySetCode: resolvePrimarySetCode(codes, pool.boosterProduct.primarySetCode),
    });
  }

  return map;
}

export function useSeasonPoolSets(leagueSlug: string | null | undefined, seasonNumber: number | null | undefined) {
  const [poolSetsByUserId, setPoolSetsByUserId] = useState<Map<string, PoolSetInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueSlug || seasonNumber == null) {
      setPoolSetsByUserId(new Map());
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiRequest<ApiListResponse<SeasonPool>>(
          `/api/leagues/${leagueSlug}/seasons/${seasonNumber}/pools`,
        );
        if (!cancelled) {
          setPoolSetsByUserId(buildPoolSetsMap(response.data));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load pools');
          setPoolSetsByUserId(new Map());
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [leagueSlug, seasonNumber]);

  return { poolSetsByUserId, isLoading, error };
}
