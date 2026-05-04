import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';

type ApiListResponse<T> = { data: T[] };

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

export function DecklistsPage() {
  const { activeSeason, activeSeasonId, isLoading: loadingLeague } = useCurrentLeague();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<SeasonEvent | null>(null);
  const [seasonDecklists, setSeasonDecklists] = useState<SeasonDecklist[]>([]);

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
        const [eventsResponse, decklistsResponse] = await Promise.all([
          apiRequest<ApiListResponse<SeasonEvent>>(`/api/seasons/${activeSeasonId}/events`),
          apiRequest<ApiListResponse<SeasonDecklist>>(`/api/decklists/my-season/${activeSeasonId}`),
        ]);

        const activeEvent =
          eventsResponse.data.find((event) => event.status === 'active') ??
          eventsResponse.data.find((event) => event.status === 'setup') ??
          null;
        setCurrentEvent(activeEvent);
        setSeasonDecklists(decklistsResponse.data);
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load deck context');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [activeSeasonId, loadingLeague]);

  const previousDecks = useMemo(
    () => seasonDecklists.filter((decklist) => decklist.event.status === 'completed'),
    [seasonDecklists],
  );

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
        <p className="text-muted-foreground mt-1">View and build decklists from your card pool.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Previous Decks This Season</h2>
        {previousDecks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No previous decks yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {previousDecks.map((decklist) => {
              const mainEntries = decklist.entries.filter((entry) => entry.zone === 'main');
              const sideEntries = decklist.entries.filter((entry) => entry.zone === 'sideboard');
              return (
                <details key={decklist.id} className="rounded-md border border-border/70 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {decklist.name ?? `Deck ${decklist.orderIndex + 1}`} - {decklist.event.name} Round {decklist.round.roundNumber}{' '}
                    <span className="text-xs text-muted-foreground">(read-only)</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Main Deck</p>
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sideboard</p>
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
        )}

        <Link to="/schedule" className="mt-4 inline-block text-sm underline">
          Go to schedule
        </Link>
      </div>
    </div>
  );
}
