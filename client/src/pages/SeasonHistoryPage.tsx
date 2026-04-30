import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';

type PointConfig = {
  matchWinPoints: number;
  matchDrawPoints: number;
  matchLossPoints: number;
  gameWinPoints: number;
  sweepBonusPoints: number;
};

type Season = {
  id: string;
  name: string;
  number: number;
  isActive: boolean;
  tradingEnabled: boolean;
  poolVisibility: boolean;
  decklistVisibility: boolean;
  scheduleVisibility: boolean;
  pointConfig: PointConfig | null;
};

type Event = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  pointMultiplier: number;
  config: {
    format: 'swiss' | 'seeded_swiss' | 'round_robin';
    bestOfN: number;
  } | null;
};

type ApiListResponse<T> = { data: T[] };

export function SeasonHistoryPage() {
  const { league, isLoading } = useCurrentLeague();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [eventsBySeason, setEventsBySeason] = useState<Record<string, Event[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!league?.slug) {
      setSeasons([]);
      setEventsBySeason({});
      return;
    }

    const load = async () => {
      try {
        setError(null);
        const seasonsResponse = await apiRequest<ApiListResponse<Season>>(`/api/leagues/${league.slug}/seasons`);
        setSeasons(seasonsResponse.data);

        const eventsEntries = await Promise.all(
          seasonsResponse.data.map(async (season) => {
            const eventsResponse = await apiRequest<ApiListResponse<Event>>(`/api/seasons/${season.id}/events`);
            return [season.id, eventsResponse.data] as const;
          }),
        );

        setEventsBySeason(Object.fromEntries(eventsEntries));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load season history');
      }
    };

    void load();
  }, [league?.slug]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Season History</h1>
        <p className="text-muted-foreground mt-1">Historical season settings and event setups.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading league context...</p> : null}

      {!isLoading && seasons.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">No seasons have been played yet.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {seasons.map((season) => (
          <div key={season.id} className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                Season {season.number}: {season.name}
              </h3>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  season.isActive
                    ? 'bg-emerald-600/15 text-emerald-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {season.isActive ? 'Active' : 'Completed'}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Trading {season.tradingEnabled ? 'On' : 'Off'} • Pool {season.poolVisibility ? 'Visible' : 'Hidden'} •
              Decklists {season.decklistVisibility ? 'Visible' : 'Hidden'} • Schedule{' '}
              {season.scheduleVisibility ? 'Visible' : 'Hidden'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Points: W {season.pointConfig?.matchWinPoints ?? 3}, D {season.pointConfig?.matchDrawPoints ?? 1}, L{' '}
              {season.pointConfig?.matchLossPoints ?? 0}, Game Win {season.pointConfig?.gameWinPoints ?? 0}, Sweep{' '}
              {season.pointConfig?.sweepBonusPoints ?? 0}
            </p>

            <div className="mt-4 space-y-2">
              {(eventsBySeason[season.id] ?? []).map((event) => (
                <div key={event.id} className="rounded border border-border p-3 text-sm">
                  <p className="font-medium">{event.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.status} • {event.config?.format ?? 'unknown'} • Bo{event.config?.bestOfN ?? '-'} • x
                    {event.pointMultiplier}
                  </p>
                </div>
              ))}
              {(eventsBySeason[season.id] ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No events configured for this season.</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
