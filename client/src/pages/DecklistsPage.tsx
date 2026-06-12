import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { primaryName } from '@/lib/userDisplay';

type ApiListResponse<T> = { data: T[]; meta?: { decklistVisibility?: boolean } };

type SeasonEvent = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  orderIndex: number;
};

type SeasonDecklist = {
  id: string;
  orderIndex: number;
  name: string | null;
  status: 'draft' | 'submitted' | 'locked';
  user?: {
    id: string;
    displayName: string;
    publicName?: string | null;
    slug: string;
  };
  event: {
    id: string;
    name: string;
    status: 'setup' | 'active' | 'completed';
    orderIndex: number;
  };
  round: {
    id: string;
    roundNumber: number;
    status: 'not_started' | 'in_progress' | 'completed';
  };
  entries: Array<{
    id: string;
    quantity: number;
    zone: 'main' | 'sideboard';
    cachedCard: {
      name: string;
      manaCost: string | null;
    };
  }>;
};

type PreviousDeckGroup = {
  eventId: string;
  eventName: string;
  orderIndex: number;
  decks: SeasonDecklist[];
};

export function DecklistsPage() {
  const { user } = useAuth();
  const { activeSeasonId, isLoading: loadingLeague } = useCurrentLeague();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<SeasonEvent | null>(null);
  const [seasonDecklists, setSeasonDecklists] = useState<SeasonDecklist[]>([]);
  const [decklistVisibility, setDecklistVisibility] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      if (loadingLeague) {
        return;
      }
      if (!activeSeasonId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const eventsResponse = await apiRequest<ApiListResponse<SeasonEvent>>(
          `/api/seasons/${activeSeasonId}/events`,
        );

        const activeEvent =
          eventsResponse.data.find((event) => event.status === 'active') ??
          eventsResponse.data.find((event) => event.status === 'setup') ??
          null;
        setCurrentEvent(activeEvent);

        if (user) {
          const myDecklistsResponse = await apiRequest<ApiListResponse<SeasonDecklist>>(
            `/api/decklists/my-season/${activeSeasonId}`,
          );
          setSeasonDecklists(myDecklistsResponse.data);
          setDecklistVisibility(true);
        } else {
          const seasonResponse = await apiRequest<ApiListResponse<SeasonDecklist>>(
            `/api/seasons/${activeSeasonId}/decklists`,
          );
          setSeasonDecklists(seasonResponse.data);
          setDecklistVisibility(seasonResponse.meta?.decklistVisibility ?? true);
        }
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load deck context');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [activeSeasonId, loadingLeague, user]);

  const previousDecks = useMemo(
    () => seasonDecklists.filter((decklist) => decklist.event.status === 'completed'),
    [seasonDecklists],
  );
  const previousDeckGroups = useMemo<PreviousDeckGroup[]>(() => {
    const grouped = new Map<string, PreviousDeckGroup>();
    for (const deck of previousDecks) {
      const existing = grouped.get(deck.event.id);
      if (existing) {
        existing.decks.push(deck);
        continue;
      }
      grouped.set(deck.event.id, {
        eventId: deck.event.id,
        eventName: deck.event.name,
        orderIndex: deck.event.orderIndex,
        decks: [deck],
      });
    }

    const groups = [...grouped.values()].sort((a, b) => b.orderIndex - a.orderIndex);
    for (const group of groups) {
      group.decks.sort((a, b) => a.round.roundNumber - b.round.roundNumber || a.orderIndex - b.orderIndex);
    }
    return groups;
  }, [previousDecks]);

  const openCurrentDeckbuilder = () => {
    if (!currentEvent) {
      return;
    }
    navigate(`/events/${currentEvent.id}/build`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Decklists</h1>
        <p className="text-muted-foreground mt-1">
          {user ? 'View and build decklists from your card pool.' : 'Browse submitted decklists for the current season.'}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {user ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Current Event Deck</h2>
          {loading ? <p className="mt-2 text-sm text-muted-foreground">Detecting current event...</p> : null}
          {!loading && currentEvent ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">{currentEvent.name}</p>
              <button
                type="button"
                onClick={openCurrentDeckbuilder}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Open Current Deckbuilder
              </button>
            </div>
          ) : null}
          {!loading && !currentEvent ? (
            <p className="mt-2 text-sm text-muted-foreground">No active event found for your current season.</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{user ? 'Previous Decklists This Season' : 'Season Decklists'}</h2>
        {!user && decklistVisibility === false ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Decklists are hidden for this season. Sign in to view your own decklists.
          </p>
        ) : previousDeckGroups.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No previous decklists yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {previousDeckGroups.map((group) => (
              <div key={group.eventId} className="rounded-lg border border-border/70 bg-background/50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{group.eventName}</h3>
                  <span className="text-xs text-muted-foreground">
                    {group.decks.length} {group.decks.length === 1 ? 'deck' : 'decks'}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.decks.map((decklist) => {
                    const mainEntries = decklist.entries.filter((entry) => entry.zone === 'main');
                    const sideEntries = decklist.entries.filter((entry) => entry.zone === 'sideboard');
                    return (
                      <details key={decklist.id} className="rounded-md border border-border/70 bg-card p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          {decklist.user ? `${primaryName(decklist.user)} — ` : ''}
                          {decklist.name ?? `Deck ${decklist.orderIndex + 1}`} - Round {decklist.round.roundNumber}{' '}
                          <span className="text-xs text-muted-foreground">(read-only)</span>
                        </summary>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Main Deck
                            </p>
                            <div className="mt-1 space-y-1 text-sm">
                              {mainEntries.length === 0 ? <p className="text-muted-foreground">No cards</p> : null}
                              {mainEntries.map((entry) => (
                                <p key={entry.id}>
                                  {entry.quantity}x {entry.cachedCard.name}
                                </p>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Sideboard
                            </p>
                            <div className="mt-1 space-y-1 text-sm">
                              {sideEntries.length === 0 ? <p className="text-muted-foreground">No cards</p> : null}
                              {sideEntries.map((entry) => (
                                <p key={entry.id}>
                                  {entry.quantity}x {entry.cachedCard.name}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link to="/schedule" className="mt-4 inline-block text-sm underline">
          Go to schedule
        </Link>
      </div>
    </div>
  );
}
