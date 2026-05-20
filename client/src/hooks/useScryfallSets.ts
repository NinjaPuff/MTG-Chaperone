import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { normalizeSetCode } from '@/lib/setSymbol';

export type ScryfallSetSummary = {
  code: string;
  name: string;
  icon_svg_uri: string | null;
};

type ApiListResponse<T> = { data: T[] };

let cachedSets: ScryfallSetSummary[] | null = null;
let inflight: Promise<ScryfallSetSummary[]> | null = null;

async function loadSets(): Promise<ScryfallSetSummary[]> {
  if (cachedSets) {
    return cachedSets;
  }

  if (!inflight) {
    inflight = apiRequest<ApiListResponse<ScryfallSetSummary>>('/api/sets')
      .then((response) => {
        cachedSets = response.data;
        return cachedSets;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

/** Clears module cache — for tests only. */
export function resetScryfallSetsCache() {
  cachedSets = null;
  inflight = null;
}

export function useScryfallSets() {
  const [sets, setSets] = useState<ScryfallSetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await loadSets();
        if (!cancelled) {
          setSets(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load sets');
          setSets([]);
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
  }, []);

  const getSet = useCallback(
    (code: string): ScryfallSetSummary | undefined => {
      const normalized = normalizeSetCode(code);
      return sets.find((set) => normalizeSetCode(set.code) === normalized);
    },
    [sets],
  );

  return { sets, getSet, isLoading, error };
}
