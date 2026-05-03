import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MatchCard } from '@/components/MatchCard';
import { ApiError, apiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useAuth } from '@/context/AuthContext';
import { computeEventRecords } from '@/lib/eventRecords';
import { primaryName } from '@/lib/userDisplay';
import { MatchInputCounts, ReportMatchDialog } from '@/components/ReportMatchDialog';

type Event = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  totalRounds: number | null;
  config: { format: string; bestOfN: number } | null;
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

function matchResultRecord(match: Match) {
  if (!['reported', 'confirmed', 'resolved'].includes(match.status) || match.gameResults.length === 0 || !match.player2) {
    return null;
  }
  const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
  const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
  const draws = match.gameResults.filter((game) => game.isDraw || !game.winnerId).length;
  return `${p1Wins}-${p2Wins}-${draws}`;
}

export function SchedulePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { activeSeasonId } = useCurrentLeague();
  const [events, setEvents] = useState<Event[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [initialReportCounts] = useState<MatchInputCounts>({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  const [seasonPoints, setSeasonPoints] = useState<Map<string, number>>(new Map());
  const [isMutatingRound, setIsMutatingRound] = useState(false);
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
  const orderedRounds = useMemo(() => {
    const priority = (status: Round['status']) => {
      if (status === 'in_progress') {
        return 0;
      }
      if (status === 'not_started') {
        return 1;
      }
      return 2;
    };
    return [...rounds].sort((a, b) => {
      const statusDiff = priority(a.status) - priority(b.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return a.roundNumber - b.roundNumber;
    });
  }, [rounds]);
  const eventRecords = useMemo(() => computeEventRecords(rounds), [rounds]);
  const roundLimit =
    selectedEvent && typeof selectedEvent.totalRounds === 'number'
      ? selectedEvent.totalRounds
      : selectedEvent?.config?.format === 'round_robin'
        ? rounds.length
        : null;

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

  const reportMatch = async (reportCounts: MatchInputCounts) => {
    if (!selectedMatch) {
      return;
    }

    const bestOfN = selectedEvent?.config?.bestOfN ?? 3;
    const requiredWins = Math.ceil(bestOfN / 2);
    const totalWins = reportCounts.player1Wins + reportCounts.player2Wins;
    if (totalWins > bestOfN) {
      setError(`Total wins cannot exceed best-of-${bestOfN}. Draws are tracked separately.`);
      return;
    }
    if (reportCounts.player1Wins > requiredWins || reportCounts.player2Wins > requiredWins) {
      setError(`A player cannot exceed ${requiredWins} wins in best-of-${bestOfN}.`);
      return;
    }
    if (reportCounts.gameDraws > 5) {
      setError('Game draws cannot exceed 5.');
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

  const transitionRound = async (roundId: string, action: 'start' | 'complete') => {
    if (selectedEvent?.status !== 'active') {
      setError('You can only start or complete rounds in active events.');
      return;
    }
    setIsMutatingRound(true);
    setError(null);
    try {
      await apiRequest(`/api/rounds/${roundId}/${action}`, { method: 'POST' });
      if (selectedEventId) {
        const response = await apiRequest<ApiListResponse<Round>>(`/api/events/${selectedEventId}/rounds`);
        setRounds(response.data);
      }
    } catch (roundError) {
      setError(roundError instanceof ApiError ? roundError.message : `Unable to ${action} round`);
    } finally {
      setIsMutatingRound(false);
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
                  {typeof roundLimit === 'number' ? ` • Rounds: ${Math.min(rounds.length, roundLimit)} of ${roundLimit}` : ''}
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

            {orderedRounds.map((round) => {
              const pendingCount = round.matches.filter((match) => match.status === 'pending').length;
              const disputedCount = round.matches.filter((match) => match.status === 'disputed').length;
              const reportedCount = round.matches.filter((match) => match.status === 'reported').length;
              const canCompleteRound = pendingCount === 0 && disputedCount === 0;
              const roundBlockedReason =
                pendingCount > 0
                  ? `Not ready: ${pendingCount} match(es) are not reported yet.`
                  : disputedCount > 0
                    ? `Not ready: ${disputedCount} disputed match(es) need resolution.`
                    : null;

              return (
              <div key={round.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    Round {round.roundNumber}
                    {typeof roundLimit === 'number' ? ` of ${roundLimit}` : ''}{' '}
                    {typeof roundLimit === 'number' && round.roundNumber === roundLimit ? (
                      <span className="ml-2 rounded-full bg-amber-500/15 border border-amber-600 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Last Round
                      </span>
                    ) : null}{' '}
                    <span className="text-xs text-muted-foreground">({round.status})</span>
                  </p>
                  {isAdmin && selectedEvent.status === 'active' ? (
                    <div className="flex items-center gap-2">
                      {round.status === 'not_started' ? (
                        <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-70"
                          disabled={isMutatingRound}
                          onClick={() => void transitionRound(round.id, 'start')}
                        >
                          Start Round
                        </button>
                      ) : null}
                      {round.status === 'in_progress' ? (
                        <button
                          type="button"
                          className={`rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                            canCompleteRound
                              ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-300'
                              : 'border-amber-600 bg-amber-600/10 text-amber-700 dark:text-amber-300'
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                          disabled={isMutatingRound || !canCompleteRound}
                          title={roundBlockedReason ?? (reportedCount > 0 ? `Ready: will auto-confirm ${reportedCount} reported match(es).` : 'Ready to complete this round.')}
                          onClick={() => void transitionRound(round.id, 'complete')}
                        >
                          Complete Round
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {isAdmin && round.status === 'in_progress' ? (
                  <div
                    className={`mt-2 rounded-md border px-2 py-1 text-xs ${
                      canCompleteRound
                        ? 'border-emerald-600/40 bg-emerald-600/5 text-emerald-700 dark:text-emerald-300'
                        : 'border-amber-600/40 bg-amber-600/5 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {!canCompleteRound
                      ? roundBlockedReason
                      : reportedCount > 0
                        ? `Ready to complete. ${reportedCount} reported match(es) will be auto-confirmed.`
                        : 'Ready to complete. All matches are already confirmed/resolved.'}
                  </div>
                ) : null}
                <div className="mt-3 space-y-2">
                  {round.matches.map((match) => {
                    const isParticipant = user && (match.player1.id === user.id || match.player2?.id === user.id);
                    const canReport = (isParticipant || isAdmin) && match.status === 'pending' && round.status === 'in_progress';
                    const canConfirmOrDispute =
                      isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
                    const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
                    const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
                    const record = matchResultRecord(match);
                    const verdict =
                      ['reported', 'confirmed', 'resolved'].includes(match.status) && match.gameResults.length > 0
                        ? p1Wins === p2Wins
                          ? { text: 'Match Draw.', tone: 'draw' as const }
                          : { text: `${p1Wins > p2Wins ? primaryName(match.player1) : primaryName(match.player2!)} won.`, tone: 'winner' as const }
                        : null;
                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        eventRecords={eventRecords}
                        seasonPoints={seasonPoints}
                        footer={
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground capitalize">{match.status.replace('_', ' ')}</p>
                            {record ? <p className="text-xs text-muted-foreground">Result: {record}</p> : null}
                            {verdict ? (
                              <p className={`text-xs font-medium ${verdict.tone === 'winner' ? 'text-emerald-600' : 'text-amber-600'}`}>{verdict.text}</p>
                            ) : null}
                          </div>
                        }
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
              );
            })}
          </>
        )}
      </div>

      {selectedMatch ? (
        <ReportMatchDialog
          match={selectedMatch}
          bestOfN={selectedEvent?.config?.bestOfN ?? 3}
          mode="report"
          initialCounts={initialReportCounts}
          isMutating={false}
          onSubmit={reportMatch}
          onClose={() => {
            setSelectedMatchId(null);
          }}
        />
      ) : null}
    </div>
  );
}
