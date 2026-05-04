import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { computeMatchRecord, getMatchOutcome } from '@/lib/matchUtils';
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
  config: {
    format: 'swiss' | 'seeded_swiss' | 'round_robin';
  };
  rounds: Array<{ status: string }>;
};

type Match = {
  id: string;
  status: string;
  player1: { id: string; displayName: string; publicName?: string | null };
  player2: { id: string; displayName: string; publicName?: string | null } | null;
  gameResults: Array<{ winnerId: string | null; isDraw: boolean }>;
};

type Round = {
  id: string;
  status: string;
  matches: Match[];
};

type ApiListResponse<T> = { data: T[] };

function formatOrdinal(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}

function formatEventFormat(format: Event['config']['format'] | undefined): string {
  if (format === 'swiss') return 'Swiss';
  if (format === 'seeded_swiss') return 'Seeded Swiss';
  if (format === 'round_robin') return 'Round Robin';
  return '';
}

function playerVerdict(match: Match, userId: string): 'Won' | 'Lost' | 'Draw' | '--' {
  const outcome = getMatchOutcome(match.status, match.player1.id, match.player2?.id ?? null, match.gameResults);
  if (!outcome) {
    return '--';
  }
  if (outcome === 'draw') {
    return 'Draw';
  }
  const userIsPlayer1 = match.player1.id === userId;
  const userIsPlayer2 = match.player2?.id === userId;
  if (!userIsPlayer1 && !userIsPlayer2) {
    return '--';
  }
  if ((userIsPlayer1 && outcome === 'player1') || (userIsPlayer2 && outcome === 'player2')) {
    return 'Won';
  }
  return 'Lost';
}

function RankChip({ rank }: { rank: number }) {
  if (rank > 3) {
    return <span className="w-6 text-center text-xs font-semibold text-muted-foreground">#{rank}</span>;
  }

  const className =
    rank === 1
      ? 'bg-yellow-500/15 text-yellow-600'
      : rank === 2
        ? 'bg-slate-300/15 text-slate-400'
        : 'bg-amber-700/15 text-amber-600';

  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${className}`}>{rank}</span>;
}

function StatCard({ title, value, subtext }: { title: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {subtext ? <p className="mt-1 text-xs text-muted-foreground">{subtext}</p> : null}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { activeSeasonId, allSeasons, isLoading: leagueLoading } = useCurrentLeague();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSeasonId && !selectedSeasonId) {
      setSelectedSeasonId(activeSeasonId);
    }
  }, [activeSeasonId, selectedSeasonId]);

  useEffect(() => {
    if (!selectedSeasonId) {
      setEvents([]);
      setStandings([]);
      setRounds([]);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [eventsResponse, standingsResponse] = await Promise.all([
          apiRequest<ApiListResponse<Event>>(`/api/seasons/${selectedSeasonId}/events`),
          apiRequest<ApiListResponse<Standing>>(`/api/seasons/${selectedSeasonId}/standings`),
        ]);
        setEvents(eventsResponse.data);
        setStandings(standingsResponse.data);

        const targetEvent = eventsResponse.data.find((event) => event.status === 'active') ?? eventsResponse.data[eventsResponse.data.length - 1];
        if (!targetEvent) {
          setRounds([]);
          return;
        }

        const roundsResponse = await apiRequest<ApiListResponse<Round>>(`/api/events/${targetEvent.id}/rounds`);
        setRounds(roundsResponse.data);
      } catch (error) {
        setEvents([]);
        setStandings([]);
        setRounds([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [selectedSeasonId]);

  const activeEvent = useMemo(() => events.find((event) => event.status === 'active') ?? null, [events]);
  const latestEvent = useMemo(() => events[events.length - 1] ?? null, [events]);
  const currentEvent = activeEvent ?? latestEvent;
  const viewingActiveSeason = selectedSeasonId === activeSeasonId;

  const userStanding = useMemo(() => standings.find((standing) => standing.user.id === user?.id) ?? null, [standings, user?.id]);
  const userRank = useMemo(() => {
    if (!user) {
      return null;
    }
    const index = standings.findIndex((standing) => standing.user.id === user.id);
    return index >= 0 ? index + 1 : null;
  }, [standings, user]);

  const allMatches = useMemo(() => rounds.flatMap((round) => round.matches), [rounds]);
  const userMatches = useMemo(
    () => allMatches.filter((match) => !!user && (match.player1.id === user.id || match.player2?.id === user.id)),
    [allMatches, user],
  );
  const nextMatch = useMemo(
    () => userMatches.find((match) => match.status === 'pending') ?? null,
    [userMatches],
  );
  const nextMatchOpponent = useMemo(() => {
    if (!user || !nextMatch) {
      return null;
    }
    return nextMatch.player1.id === user.id ? nextMatch.player2 : nextMatch.player1;
  }, [nextMatch, user]);
  const recentResults = useMemo(() => userMatches.slice(-5).reverse(), [userMatches]);

  const roundProgress = useMemo(() => {
    const inProgressRound = rounds.find((round) => round.status === 'in_progress');
    if (!inProgressRound) {
      return null;
    }
    const reportedCount = inProgressRound.matches.filter((match) =>
      ['reported', 'confirmed', 'resolved'].includes(match.status),
    ).length;
    return {
      reportedCount,
      totalCount: inProgressRound.matches.length,
    };
  }, [rounds]);

  const renderTop3 = () => (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground">Top 3 Snapshot</h3>
      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">...</p>
      ) : standings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No standings yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {standings.slice(0, 3).map((standing, index) => (
            <div key={standing.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <RankChip rank={index + 1} />
                <span className="truncate">{primaryName(standing.user)}</span>
              </div>
              <span className="font-semibold">{standing.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRecentResults = () => (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground">Recent Results</h3>
      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">...</p>
      ) : recentResults.length === 0 || !user ? (
        <p className="mt-2 text-sm text-muted-foreground">No recent results.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {recentResults.map((match) => {
            const opponent = match.player1.id === user.id ? match.player2 : match.player1;
            const record = computeMatchRecord(user.id, match.gameResults);
            const verdict = playerVerdict(match, user.id);
            return (
              <div key={match.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{opponent ? primaryName(opponent) : 'BYE'}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded border border-border px-2 py-0.5 text-muted-foreground">
                    {record.wins}-{record.losses}-{record.draws}
                  </span>
                  <span className="font-semibold">{verdict}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">League overview with personal and season-level insights.</p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Season</span>
          <select
            className="w-full min-w-48 rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={selectedSeasonId ?? ''}
            onChange={(event) => setSelectedSeasonId(event.target.value || null)}
            disabled={leagueLoading || allSeasons.length === 0}
          >
            {allSeasons.length === 0 ? <option value="">No seasons</option> : null}
            {allSeasons.map((season) => (
              <option key={season.id} value={season.id}>
                Season {season.number}
                {season.id === activeSeasonId ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <StatCard
            title="Your Rank"
            value={isLoading ? '...' : userRank ? `${formatOrdinal(userRank)} of ${standings.length}` : '--'}
            subtext="Season standings"
          />
          <StatCard
            title="Your Record"
            value={isLoading ? '...' : userStanding ? `${userStanding.matchWins}-${userStanding.matchLosses}-${userStanding.matchDraws}` : '0-0-0'}
            subtext="Wins - Losses - Draws"
          />
          <StatCard title="Your Points" value={isLoading ? '...' : userStanding?.points ?? 0} subtext="Season points" />
          {(viewingActiveSeason && nextMatch) ? (
            <StatCard
              title="Next Match"
              value={nextMatchOpponent ? primaryName(nextMatchOpponent) : 'BYE'}
              subtext={`${activeEvent?.name ?? 'Current event'} - Pending`}
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <StatCard
            title="Active Event"
            value={isLoading ? '...' : currentEvent?.name ?? '--'}
            subtext={
              isLoading
                ? undefined
                : activeEvent
                  ? formatEventFormat(activeEvent.config?.format)
                  : currentEvent
                    ? `${formatEventFormat(currentEvent.config?.format)} (Complete)`
                    : 'No active event'
            }
          />
          {(viewingActiveSeason && activeEvent && roundProgress) ? (
            <StatCard title="Round Progress" value={`${roundProgress.reportedCount} of ${roundProgress.totalCount} reported`} subtext="Current round" />
          ) : null}
          {renderTop3()}
          {renderRecentResults()}
        </div>
      </div>
    </div>
  );
}
