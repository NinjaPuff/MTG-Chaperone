import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MatchCard } from '@/components/MatchCard';
import { ApiError, apiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useAuth } from '@/context/AuthContext';
import { computeEventRecords } from '@/lib/eventRecords';
import { primaryName } from '@/lib/userDisplay';

type Event = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  config: { format: string } | null;
};

type Match = {
  id: string;
  status: 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
  player1: { id: string; displayName: string; publicName?: string | null; slug: string; avatarUrl?: string | null };
  player2: { id: string; displayName: string; publicName?: string | null; slug: string; avatarUrl?: string | null } | null;
  gameResults: Array<{ id: string; winnerId: string | null; isDraw: boolean }>;
  isBye: boolean;
  reportedById: string | null;
};

type Round = {
  id: string;
  roundNumber: number;
  status: 'not_started' | 'in_progress' | 'completed';
  matches: Match[];
};

type ApiListResponse<T> = { data: T[] };

type StandingRow = {
  userId: string;
  points: number;
};

export function SchedulePage() {
  const { user } = useAuth();
  const { activeSeasonId } = useCurrentLeague();
  const [events, setEvents] = useState<Event[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [reportCounts, setReportCounts] = useState({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  const [seasonPoints, setSeasonPoints] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  useEffect(() => {
    if (!activeSeasonId) {
      return;
    }

    const loadEvents = async () => {
      try {
        const response = await apiRequest<ApiListResponse<Event>>(`/api/seasons/${activeSeasonId}/events`);
        setEvents(response.data);
        const active = response.data.find((event) => event.status === 'active') ?? response.data[0] ?? null;
        setSelectedEventId(active?.id ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load events');
      }
    };

    void loadEvents();
  }, [activeSeasonId]);

  useEffect(() => {
    if (!selectedEventId) {
      setRounds([]);
      return;
    }
    const loadRounds = async () => {
      try {
        const response = await apiRequest<ApiListResponse<Round>>(`/api/events/${selectedEventId}/rounds`);
        setRounds(response.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load rounds');
      }
    };
    void loadRounds();
  }, [selectedEventId]);

  const selectedMatch = useMemo(
    () => rounds.flatMap((round) => round.matches).find((match) => match.id === selectedMatchId) ?? null,
    [rounds, selectedMatchId],
  );
  const eventRecords = useMemo(() => computeEventRecords(rounds), [rounds]);

  useEffect(() => {
    if (!activeSeasonId) {
      setSeasonPoints(new Map());
      return;
    }

    const loadStandings = async () => {
      try {
        const response = await apiRequest<ApiListResponse<StandingRow>>(`/api/standings/${activeSeasonId}`);
        setSeasonPoints(new Map(response.data.map((standing) => [standing.userId, standing.points])));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load standings');
      }
    };

    void loadStandings();
  }, [activeSeasonId]);

  const reportMatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMatch) {
      return;
    }

    const totalGames = reportCounts.player1Wins + reportCounts.player2Wins + reportCounts.gameDraws;
    if (totalGames === 0) {
      setError('Enter at least one game result.');
      return;
    }
    if (!Number.isInteger(reportCounts.player1Wins) || !Number.isInteger(reportCounts.player2Wins) || !Number.isInteger(reportCounts.gameDraws)) {
      setError('Wins and draws must be whole numbers.');
      return;
    }

    const gameResults: Array<{ winnerId: string | null; isDraw: boolean }> = [];
    for (let i = 0; i < reportCounts.player1Wins; i += 1) {
      gameResults.push({ winnerId: selectedMatch.player1.id, isDraw: false });
    }
    for (let i = 0; i < reportCounts.player2Wins; i += 1) {
      gameResults.push({ winnerId: selectedMatch.player2?.id ?? null, isDraw: false });
    }
    for (let i = 0; i < reportCounts.gameDraws; i += 1) {
      gameResults.push({ winnerId: null, isDraw: true });
    }

    try {
      await apiRequest(`/api/matches/${selectedMatch.id}/report`, {
        method: 'POST',
        body: {
          gameResults,
        },
      });
      setSelectedMatchId(null);
      setReportCounts({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
      if (selectedEventId) {
        const response = await apiRequest<ApiListResponse<Round>>(`/api/events/${selectedEventId}/rounds`);
        setRounds(response.data);
      }
    } catch (reportError) {
      setError(reportError instanceof ApiError ? reportError.message : 'Unable to report match');
    }
  };

  const confirmOrDispute = async (matchId: string, action: 'confirm' | 'dispute') => {
    try {
      await apiRequest(`/api/matches/${matchId}/${action}`, { method: 'POST' });
      if (selectedEventId) {
        const response = await apiRequest<ApiListResponse<Round>>(`/api/events/${selectedEventId}/rounds`);
        setRounds(response.data);
      }
    } catch (matchError) {
      setError(matchError instanceof ApiError ? matchError.message : `Unable to ${action} match`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-muted-foreground mt-1">Current event rounds, pairings, and match reporting.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        {!selectedEvent ? (
          <p className="text-muted-foreground text-sm">No active events. Check back when a new event starts.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{selectedEvent.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedEvent.status} • {selectedEvent.config?.format ?? 'unknown format'}
                </p>
                <Link to={`/events/${selectedEvent.id}`} className="text-xs underline text-muted-foreground">
                  View Event Details
                </Link>
              </div>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedEventId ?? ''}
                onChange={(event) => setSelectedEventId(event.target.value)}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {rounds.map((round) => (
              <div key={round.id} className="rounded-md border border-border p-3">
                <p className="font-medium">
                  Round {round.roundNumber} <span className="text-xs text-muted-foreground">({round.status})</span>
                </p>
                <div className="mt-3 space-y-2">
                  {round.matches.map((match) => {
                    const isParticipant = user && (match.player1.id === user.id || match.player2?.id === user.id);
                    const canReport = isParticipant && match.status === 'pending';
                    const canConfirmOrDispute =
                      isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        eventRecords={eventRecords}
                        seasonPoints={seasonPoints}
                        footer={<p className="text-xs text-muted-foreground capitalize">{match.status.replace('_', ' ')}</p>}
                        actions={
                          <>
                            {canReport ? (
                              <button
                                type="button"
                                className="rounded-md border border-border px-2 py-1 text-xs"
                                onClick={() => setSelectedMatchId(match.id)}
                              >
                                Report
                              </button>
                            ) : null}
                            {canConfirmOrDispute ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded-md border border-border px-2 py-1 text-xs"
                                  onClick={() => confirmOrDispute(match.id, 'confirm')}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-border px-2 py-1 text-xs"
                                  onClick={() => confirmOrDispute(match.id, 'dispute')}
                                >
                                  Dispute
                                </button>
                              </>
                            ) : null}
                          </>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {selectedMatch ? (
        <form onSubmit={reportMatch} className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h3 className="text-lg font-semibold">Report Match</h3>
          <p className="text-sm text-muted-foreground">
            {primaryName(selectedMatch.player1)} vs {selectedMatch.player2 ? primaryName(selectedMatch.player2) : ''}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              {primaryName(selectedMatch.player1)} wins
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={reportCounts.player1Wins}
                onChange={(event) =>
                  setReportCounts((prev) => ({
                    ...prev,
                    player1Wins: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              {selectedMatch.player2 ? primaryName(selectedMatch.player2) : 'Opponent'} wins
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={reportCounts.player2Wins}
                onChange={(event) =>
                  setReportCounts((prev) => ({
                    ...prev,
                    player2Wins: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              Game draws
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={reportCounts.gameDraws}
                onChange={(event) =>
                  setReportCounts((prev) => ({
                    ...prev,
                    gameDraws: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Submit Report
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              onClick={() => {
                setSelectedMatchId(null);
                setReportCounts({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
