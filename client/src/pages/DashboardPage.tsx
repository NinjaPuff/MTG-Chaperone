import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { primaryName } from '@/lib/userDisplay';

type Standing = {
  id: string;
  points: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  user: {
    id: string;
    displayName: string;
    publicName?: string | null;
  };
};

type Event = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
};

type Match = {
  id: string;
  status: string;
  player1: { id: string; displayName: string; publicName?: string | null };
  player2: { id: string; displayName: string; publicName?: string | null } | null;
};

type Round = {
  id: string;
  matches: Match[];
};

type ApiListResponse<T> = { data: T[] };

export function DashboardPage() {
  const { user } = useAuth();
  const { activeSeasonId } = useCurrentLeague();
  const [events, setEvents] = useState<Event[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);

  const userStanding = useMemo(() => standings.find((standing) => standing.user.id === user?.id) ?? null, [standings, user?.id]);

  useEffect(() => {
    if (!activeSeasonId) {
      return;
    }
    const load = async () => {
      const [eventsResponse, standingsResponse] = await Promise.all([
        apiRequest<ApiListResponse<Event>>(`/api/seasons/${activeSeasonId}/events`),
        apiRequest<ApiListResponse<Standing>>(`/api/seasons/${activeSeasonId}/standings`),
      ]);
      setEvents(eventsResponse.data);
      setStandings(standingsResponse.data);

      const activeEvent = eventsResponse.data.find((event) => event.status === 'active') ?? eventsResponse.data[0];
      if (!activeEvent) {
        setRecentMatches([]);
        return;
      }

      const roundsResponse = await apiRequest<ApiListResponse<Round>>(`/api/events/${activeEvent.id}/rounds`);
      const matches = roundsResponse.data.flatMap((round) => round.matches);
      setRecentMatches(matches.slice(0, 5));
    };

    void load();
  }, [activeSeasonId]);

  const nextMatch = recentMatches.find(
    (match) => user && match.status === 'pending' && (match.player1.id === user.id || match.player2?.id === user.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">League overview, current season, and recent results.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Next Match</h3>
          <p className="mt-2 text-xl font-bold">
            {nextMatch
              ? `${primaryName(nextMatch.player1)} vs ${nextMatch.player2 ? primaryName(nextMatch.player2) : 'BYE'}`
              : '--'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {nextMatch ? 'Pending report' : 'No active pending match'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Your Record</h3>
          <p className="mt-2 text-2xl font-bold">
            {userStanding ? `${userStanding.matchWins}-${userStanding.matchLosses}-${userStanding.matchDraws}` : '0-0-0'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Wins - Losses - Draws</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Current Event</h3>
          <p className="mt-2 text-2xl font-bold">{events.find((event) => event.status === 'active')?.name ?? '--'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {events.find((event) => event.status === 'active') ? 'Event in progress' : 'No active event'}
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Results</h3>
        {recentMatches.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent match results.</p>
        ) : (
          <div className="space-y-2">
            {recentMatches.map((match) => (
              <div key={match.id} className="flex items-center justify-between text-sm">
                <span>
                  {primaryName(match.player1)} vs {match.player2 ? primaryName(match.player2) : 'BYE'}
                </span>
                <span className="text-muted-foreground">{match.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
