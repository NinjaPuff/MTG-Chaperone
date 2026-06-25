import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MatchCard } from '@/components/MatchCard';
import { ApiError, apiRequest, authApiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useScryfallSets } from '@/hooks/useScryfallSets';
import { useSeasonPoolSets } from '@/hooks/useSeasonPoolSets';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { computeEventRecords } from '@/lib/eventRecords';
import { confirmDisputeMatch } from '@/lib/matchDisputeConfirm';
import { primaryName } from '@/lib/userDisplay';
import { ReportMatchDialog } from '@/components/ReportMatchDialog';
import {
  type MatchInputCounts,
  toGameResultBody,
  validateReportCounts,
} from '@/lib/matchReporting';
import { BracketView } from '@/components/bracket/BracketView';
import type { BracketSlotView } from '@/components/bracket/types';
import { fetchBracketState, reloadBracketEventViews } from '@/lib/bracketApi';
import { getUserActiveMatches, formatActiveRoundLabel } from '@/lib/activeMatches';
import { ParticipantMatchCard } from '@/components/matches/ParticipantMatchCard';
import { isBracketFormat } from '@mtg-league/shared';

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
  return `${p1Wins}-${p2Wins}`;
}

export function SchedulePage() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const isAdmin = user?.role === 'admin';
  const { league, activeSeason, activeSeasonId } = useCurrentLeague();
  const { poolSetsByUserId, isLoading: poolSetsLoading } = useSeasonPoolSets(league?.slug, activeSeason?.number);
  const { getSet } = useScryfallSets();
  const [events, setEvents] = useState<Event[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [bracketSlots, setBracketSlots] = useState<BracketSlotView[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [initialReportCounts] = useState<MatchInputCounts>({ player1Wins: 0, player2Wins: 0 });
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
        if (selectedEvent?.config?.format && isBracketFormat(selectedEvent.config.format)) {
          setBracketSlots(await fetchBracketState(selectedEventId));
        } else {
          setBracketSlots([]);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load rounds');
      }
    };
    void loadRounds();
  }, [selectedEventId, selectedEvent?.config?.format]);

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
  const reloadEventViews = async () => {
    if (!selectedEventId || !selectedEvent) {
      return;
    }
    const isBracketEvent = Boolean(selectedEvent.config?.format && isBracketFormat(selectedEvent.config.format));
    const { rounds: nextRounds, bracketSlots: nextBracketSlots } = await reloadBracketEventViews<Round>(
      selectedEventId,
      isBracketEvent,
    );
    setRounds(nextRounds);
    setBracketSlots(nextBracketSlots);
  };

  const userActiveMatches = useMemo(
    () => getUserActiveMatches<Match, Round>(rounds, user?.id),
    [rounds, user?.id],
  );
  const eventRecords = useMemo(() => computeEventRecords(rounds), [rounds]);
  const showActiveMatchesSection = Boolean(
    user && selectedEvent?.status === 'active' && userActiveMatches.length > 0,
  );
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
    const validationError = validateReportCounts(reportCounts, bestOfN);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!selectedMatch.player2) {
      setError('Both players are required to report a match.');
      return;
    }

    const gameResults = toGameResultBody(
      selectedMatch.player1.id,
      selectedMatch.player2.id,
      reportCounts,
    );

    try {
      await authApiRequest(`/api/matches/${selectedMatch.id}/report`, {
        method: 'POST',
        body: {
          gameResults,
        },
      });
      setSelectedMatchId(null);
      if (selectedEventId) {
        await reloadEventViews();
      }
    } catch (reportError) {
      setError(reportError instanceof ApiError ? reportError.message : 'Unable to report match');
    }
  };

  const confirmOrDispute = async (matchId: string, action: 'confirm' | 'dispute') => {
    if (action === 'dispute' && !(await confirmDisputeMatch(confirm))) {
      return;
    }
    try {
      await authApiRequest(`/api/matches/${matchId}/${action}`, { method: 'POST' });
      if (selectedEventId) {
        await reloadEventViews();
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
      await authApiRequest(`/api/rounds/${roundId}/${action}`, { method: 'POST' });
      if (selectedEventId) {
        await reloadEventViews();
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

            {showActiveMatchesSection ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Your Active Matches</h2>
                  <p className="text-sm text-muted-foreground">Report or confirm bracket matches you can play now.</p>
                </div>
                <div className="space-y-4">
                  {userActiveMatches.map(({ match, round }) => (
                    <div key={match.id} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatActiveRoundLabel(round.roundNumber, selectedEvent.config?.format)}
                      </p>
                      <ParticipantMatchCard
                        match={match}
                        round={round}
                        user={user}
                        isAdmin={isAdmin}
                        eventRecords={eventRecords}
                        seasonPoints={seasonPoints}
                        poolSetsByUserId={poolSetsByUserId}
                        poolSetsLoading={poolSetsLoading}
                        getSet={getSet}
                        onReport={setSelectedMatchId}
                        onConfirm={(matchId) => void confirmOrDispute(matchId, 'confirm')}
                        onDispute={(matchId) => void confirmOrDispute(matchId, 'dispute')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedEvent.config?.format && isBracketFormat(selectedEvent.config.format) ? (
              <BracketView slots={bracketSlots} />
            ) : null}

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
                    {formatActiveRoundLabel(round.roundNumber, selectedEvent.config?.format)}
                    {typeof roundLimit === 'number' &&
                    !(selectedEvent.config?.format && isBracketFormat(selectedEvent.config.format))
                      ? ` of ${roundLimit}`
                      : ''}{' '}
                    {typeof roundLimit === 'number' &&
                    !(selectedEvent.config?.format && isBracketFormat(selectedEvent.config.format)) &&
                    round.roundNumber === roundLimit ? (
                      <span className="ml-2 rounded-full bg-amber-500/15 border border-amber-600 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Last Round
                      </span>
                    ) : null}{' '}
                    <span className="text-xs text-muted-foreground">({round.status})</span>
                  </p>
                  {isAdmin && selectedEvent.status === 'active' && !(selectedEvent.config?.format && isBracketFormat(selectedEvent.config.format)) ? (
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
                          ? { text: 'Match ended in a draw.', tone: 'draw' as const }
                          : { text: `${p1Wins > p2Wins ? primaryName(match.player1) : primaryName(match.player2!)} won.`, tone: 'winner' as const }
                        : null;
                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        eventRecords={eventRecords}
                        seasonPoints={seasonPoints}
                        poolSetsByUserId={poolSetsByUserId}
                        poolSetsLoading={poolSetsLoading}
                        getSet={getSet}
                        footer={
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground capitalize">{match.status.replace('_', ' ')}</p>
                            {record ? <p className="text-xs text-muted-foreground">Result: {record}</p> : null}
                            {verdict ? (
                              <p
                                className={`text-xs font-medium ${
                                  verdict.tone === 'winner'
                                    ? 'text-emerald-600'
                                    : verdict.tone === 'draw'
                                      ? 'text-amber-600'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {verdict.text}
                              </p>
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
