import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArchiveDeckRow, type ArchiveDecklist } from '@/components/deckbuilder/ArchiveDeckRow';
import { useAuth } from '@/context/AuthContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { authApiRequest } from '@/lib/api';
import { primaryName } from '@/lib/userDisplay';

type DeckCheckUser = {
  id: string;
  displayName: string;
  publicName: string | null;
  slug: string;
  avatarUrl: string | null;
};

type DeckCheckPlayer = {
  user: DeckCheckUser;
  registeredCount: number;
  requiredCount: number;
};

type DeckCheckPayload = {
  emptyReason: 'no_active_season' | 'no_current_event' | 'no_current_round' | null;
  season: { id: string; name: string; decklistVisibility: boolean } | null;
  event: { id: string; name: string; status: 'setup' | 'active' | 'completed' } | null;
  round: { id: string; roundNumber: number; status: 'not_started' | 'in_progress' | 'completed' } | null;
  deckCount: number | null;
  decklists: ArchiveDecklist[];
  players: DeckCheckPlayer[];
};

type ApiResponse<T> = { data: T };

const emptyCopy: Record<Exclude<DeckCheckPayload['emptyReason'], null>, string> = {
  no_active_season: 'No active season.',
  no_current_event: 'No current event.',
  no_current_round: 'No current deckbuilder round.',
};

function matchesSearch(name: string, query: string) {
  if (!query) {
    return true;
  }
  return name.toLowerCase().includes(query.toLowerCase());
}

export function AdminDeckChecksPage() {
  const { user } = useAuth();
  const { activeSeasonId, isLoading: loadingLeague } = useCurrentLeague();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DeckCheckPayload | null>(null);
  const [search, setSearch] = useState('');

  const querySeasonId = searchParams.get('seasonId')?.trim() || activeSeasonId || null;

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      return;
    }
    if (loadingLeague) {
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const path = querySeasonId
          ? `/api/admin/deck-checks?seasonId=${encodeURIComponent(querySeasonId)}`
          : '/api/admin/deck-checks';
        const response = await authApiRequest<ApiResponse<DeckCheckPayload>>(path);
        setPayload(response.data);
      } catch {
        setPayload(null);
        setError('Unable to load deck checks');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user, loadingLeague, querySeasonId]);

  const query = search.trim();
  const filteredPlayers = useMemo(() => {
    if (!payload) {
      return [];
    }
    return payload.players.filter((player) => matchesSearch(primaryName(player.user), query));
  }, [payload, query]);

  const registeredGroups = useMemo(() => {
    if (!payload) {
      return [];
    }
    const allowedIds = new Set(filteredPlayers.map((player) => player.user.id));
    const byPlayer = new Map<string, { playerName: string; decks: ArchiveDecklist[] }>();
    for (const decklist of payload.decklists) {
      const ownerId = decklist.user?.id;
      if (!ownerId || !allowedIds.has(ownerId)) {
        continue;
      }
      const playerName = decklist.user ? primaryName(decklist.user) : '';
      const group = byPlayer.get(ownerId) ?? { playerName, decks: [] };
      group.decks.push(decklist);
      byPlayer.set(ownerId, group);
    }
    return [...byPlayer.entries()]
      .map(([playerKey, group]) => ({
        playerKey,
        playerName: group.playerName,
        decks: [...group.decks].sort((a, b) => a.orderIndex - b.orderIndex),
      }))
      .sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [filteredPlayers, payload]);

  const incompletePlayers = useMemo(
    () => filteredPlayers.filter((player) => player.registeredCount < player.requiredCount),
    [filteredPlayers],
  );

  if (!user || user.role !== 'admin') {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Deck checks</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {!user ? 'You must be signed in to access admin tools.' : 'You do not have admin access.'}
        </p>
      </div>
    );
  }

  const fullyRegistered = payload?.players.filter((player) => player.registeredCount >= player.requiredCount).length ?? 0;
  const noSearchMatches = Boolean(payload && query && filteredPlayers.length === 0);
  const emptyReason = payload?.emptyReason ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deck checks</h1>
        <p className="text-muted-foreground mt-1">Registered lists for the current event and deckbuilder round.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading deck checks...</p> : null}

      {!loading && emptyReason ? (
        <p className="text-sm text-muted-foreground">{emptyCopy[emptyReason]}</p>
      ) : null}

      {!loading && payload && emptyReason === null ? (
        <>
          <div className="rounded-lg border border-border bg-card p-6 space-y-2">
            {payload.season ? <p className="text-sm text-muted-foreground">{payload.season.name}</p> : null}
            {payload.event ? <p className="text-lg font-semibold">{payload.event.name}</p> : null}
            {payload.round ? <p className="text-sm">Round {payload.round.roundNumber}</p> : null}
            <p className="text-sm text-muted-foreground">
              {fullyRegistered}/{payload.players.length} fully registered
            </p>
            <label className="block text-sm font-medium">
              Search players
              <input
                type="search"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {noSearchMatches ? (
            <p className="text-sm text-muted-foreground">No players match your search.</p>
          ) : (
            <>
              <section className="rounded-lg border border-border bg-card p-6 space-y-3">
                <h2 className="text-lg font-semibold">Registered lists</h2>
                {registeredGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No registered lists for this round.</p>
                ) : (
                  registeredGroups.map((group) => (
                    <div key={group.playerKey} className="space-y-2">
                      <h3 className="text-sm font-semibold">{group.playerName}</h3>
                      {group.decks.map((decklist) => (
                        <ArchiveDeckRow
                          key={decklist.id}
                          decklist={decklist}
                          playerName={group.playerName}
                          canShare={false}
                          ownerDisplayName={group.playerName}
                          showShareActions={false}
                        />
                      ))}
                    </div>
                  ))
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-6 space-y-3">
                <h2 className="text-lg font-semibold">Not finished registering</h2>
                {incompletePlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Every player has finished registering.</p>
                ) : (
                  <ul className="space-y-2">
                    {incompletePlayers.map((player) => (
                      <li key={player.user.id} className="flex items-center justify-between text-sm">
                        <span>{primaryName(player.user)}</span>
                        <span className="text-muted-foreground">
                          {player.registeredCount}/{player.requiredCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
