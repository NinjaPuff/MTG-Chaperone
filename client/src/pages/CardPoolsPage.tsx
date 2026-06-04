import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '@/lib/api';
import { SetSymbolGroup } from '@/components/SetSymbolGroup';
import { useAuth } from '@/context/AuthContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useScryfallSets } from '@/hooks/useScryfallSets';
import { primaryName, profileSubtitle } from '@/lib/userDisplay';

type CardPoolSummary = {
  id: string;
  user: {
    id: string;
    displayName: string;
    publicName?: string | null;
    discordHandle?: string | null;
    slug: string;
    avatarUrl: string | null;
  };
  boosterProduct: {
    id: string;
    name: string;
    boosterType: 'draft' | 'play' | 'set' | 'collector';
    primarySetCode?: string | null;
    setCodes: Array<{ id: string; setCode: string }>;
  };
};

type LeagueMember = {
  id: string;
  user: { id: string };
};

type ApiListResponse<T> = { data: T[]; meta?: { poolVisibility?: boolean } };

function PoolListRow({
  pool,
  className,
  getSet,
}: {
  pool: CardPoolSummary;
  className?: string;
  getSet: ReturnType<typeof useScryfallSets>['getSet'];
}) {
  return (
    <Link
      to={`/pools/${pool.id}`}
      className={className ?? 'block rounded-md border border-border p-3 transition-colors hover:bg-muted/40'}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{primaryName(pool.user)}</p>
          {profileSubtitle(pool.user) ? (
            <p className="text-xs text-muted-foreground">{profileSubtitle(pool.user)}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {pool.boosterProduct.name} ({pool.boosterProduct.boosterType})
          </p>
        </div>
        <SetSymbolGroup
          setCodes={pool.boosterProduct.setCodes.map((entry) => entry.setCode)}
          primarySetCode={pool.boosterProduct.primarySetCode}
          getSet={getSet}
        />
      </div>
    </Link>
  );
}

export function CardPoolsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { league, activeSeason, isLoading } = useCurrentLeague();
  const { getSet } = useScryfallSets();
  const [pools, setPools] = useState<CardPoolSummary[]>([]);
  const [poolVisibility, setPoolVisibility] = useState<boolean | null>(null);
  const [isLeagueMember, setIsLeagueMember] = useState(false);
  const [membersResolved, setMembersResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!league || !activeSeason || authLoading) {
        return;
      }

      if (!user) {
        setIsLeagueMember(false);
        setMembersResolved(true);
      } else {
        setMembersResolved(false);
        setIsLeagueMember(false);
      }

      try {
        setError(null);

        if (!user) {
          const response = await apiRequest<ApiListResponse<CardPoolSummary>>(
            `/api/leagues/${league.slug}/seasons/${activeSeason.number}/pools`,
          );
          setPools(response.data);
          setPoolVisibility(response.meta?.poolVisibility ?? true);
          return;
        }

        const poolsPath = `/api/leagues/${league.slug}/seasons/${activeSeason.number}/pools`;
        const membersPath = `/api/leagues/${league.slug}/members`;

        const [poolsResult, membersResult] = await Promise.allSettled([
          apiRequest<ApiListResponse<CardPoolSummary>>(poolsPath),
          apiRequest<ApiListResponse<LeagueMember>>(membersPath),
        ]);

        if (poolsResult.status === 'fulfilled') {
          setPools(poolsResult.value.data);
          setPoolVisibility(poolsResult.value.meta?.poolVisibility ?? true);
        } else {
          const loadError = poolsResult.reason;
          setPools([]);
          setError(loadError instanceof ApiError ? loadError.message : 'Unable to load card pools');
        }

        if (membersResult.status === 'fulfilled') {
          setIsLeagueMember(membersResult.value.data.some((member) => member.user.id === user.id));
        } else {
          setIsLeagueMember(false);
        }
        setMembersResolved(true);
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load card pools');
        setMembersResolved(true);
      }
    };

    if (!league || !activeSeason) {
      setPools([]);
      setIsLeagueMember(false);
      setMembersResolved(!user);
      return;
    }

    void load();
  }, [league?.slug, activeSeason?.number, user?.id, authLoading]);

  const myPool = useMemo(
    () => (user ? (pools.find((pool) => pool.user.id === user.id) ?? null) : null),
    [pools, user],
  );
  const otherPools = useMemo(
    () => (user ? pools.filter((pool) => pool.user.id !== user.id) : pools),
    [pools, user],
  );
  const showMemberSection = Boolean(user && !authLoading && membersResolved && isLeagueMember);

  const emptyListMessage = (() => {
    if (otherPools.length > 0) {
      return null;
    }
    if (showMemberSection) {
      return 'No other pools registered.';
    }
    if (poolVisibility === false) {
      return 'Card pools are hidden for this season. Sign in to view your own pool.';
    }
    return 'No pools registered.';
  })();

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
            {showMemberSection ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your pool</h3>
                {myPool ? (
                  <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-3 ring-1 ring-primary/10">
                    <PoolListRow pool={myPool} className="block transition-colors hover:opacity-90" getSet={getSet} />
                  </div>
                ) : (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                    You&apos;re in this league, but a league admin still needs to assign your set (booster product).
                    Ask an admin to assign your pool in the admin panel.
                  </p>
                )}
              </div>
            ) : null}

            {showMemberSection && otherPools.length > 0 ? (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">All pools</h3>
            ) : null}

            {otherPools.map((pool) => (
              <PoolListRow key={pool.id} pool={pool} getSet={getSet} />
            ))}

            {emptyListMessage ? <p className="text-muted-foreground text-sm">{emptyListMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
