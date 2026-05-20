import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '@/lib/api';
import { SetSymbolGroup } from '@/components/SetSymbolGroup';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useScryfallSets } from '@/hooks/useScryfallSets';
import { primaryName, secondaryName } from '@/lib/userDisplay';

type CardPoolSummary = {
  id: string;
  user: {
    id: string;
    displayName: string;
    publicName?: string | null;
    slug: string;
    avatarUrl: string | null;
  };
  boosterProduct: {
    id: string;
    name: string;
    boosterType: 'draft' | 'play' | 'set' | 'collector';
    setCodes: Array<{ id: string; setCode: string }>;
  };
};

type ApiListResponse<T> = { data: T[] };

export function CardPoolsPage() {
  const { league, activeSeason, isLoading } = useCurrentLeague();
  const { getSet } = useScryfallSets();
  const [pools, setPools] = useState<CardPoolSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!league || !activeSeason) {
        setPools([]);
        return;
      }

      try {
        const response = await apiRequest<ApiListResponse<CardPoolSummary>>(
          `/api/leagues/${league.slug}/seasons/${activeSeason.number}/pools`,
        );
        setPools(response.data);
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load card pools');
      }
    };

    void load();
  }, [league?.slug, activeSeason?.number]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Card Pools</h1>
        <p className="text-muted-foreground mt-1">Browse player card pools for the current season.</p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground text-sm">Loading current league...</p>
        </div>
      ) : null}

      {!isLoading && !league ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground text-sm">No league found.</p>
        </div>
      ) : null}

      {!isLoading && league && !activeSeason ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground text-sm">No active season.</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!isLoading && league && activeSeason ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">
            {league.name} - Season {activeSeason.number}
          </h2>
          <div className="mt-4 space-y-3">
            {pools.map((pool) => (
              <Link
                key={pool.id}
                to={`/pools/${pool.id}`}
                className="block rounded-md border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{primaryName(pool.user)}</p>
                    {secondaryName(pool.user) ? (
                      <p className="text-xs text-muted-foreground">{secondaryName(pool.user)}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pool.boosterProduct.name} ({pool.boosterProduct.boosterType})
                    </p>
                  </div>
                  <SetSymbolGroup
                    setCodes={pool.boosterProduct.setCodes.map((entry) => entry.setCode)}
                    getSet={getSet}
                  />
                </div>
              </Link>
            ))}
            {pools.length === 0 ? <p className="text-muted-foreground text-sm">No pools registered.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
