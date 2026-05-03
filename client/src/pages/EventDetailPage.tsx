import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiRequest } from '@/lib/api';
import { MatchCard } from '@/components/MatchCard';
import { computeEventRecords } from '@/lib/eventRecords';
import { primaryName } from '@/lib/userDisplay';
import { MatchInputCounts, ReportMatchDialog } from '@/components/ReportMatchDialog';

type ApiResponse<T> = { data: T };
type ApiListResponse<T> = { data: T[] };

type EventStatus = 'setup' | 'active' | 'completed';
type RoundStatus = 'not_started' | 'in_progress' | 'completed';
type MatchStatus = 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
type SeedingSource = 'previous_season' | 'previous_event' | 'manual' | null;
type EventConfig = {
  format: 'swiss' | 'seeded_swiss' | 'round_robin';
  bestOfN: number;
  seedingSource: SeedingSource;
};

type UserSummary = {
  id: string;
  displayName: string;
  publicName?: string | null;
  slug: string;
  avatarUrl?: string | null;
};

type EventMembership = {
  userId: string;
  user: UserSummary;
};

type EventDetail = {
  id: string;
  name: string;
  status: EventStatus;
  pointMultiplier: number;
  totalRounds: number | null;
  config: EventConfig | null;
  season: {
    id: string;
    league: {
      id: string;
      slug: string;
      memberships: EventMembership[];
    };
  };
};

type GameResult = {
  id: string;
  gameNumber: number;
  winnerId: string | null;
  isDraw: boolean;
};

type Match = {
  id: string;
  status: MatchStatus;
  player1: UserSummary;
  player2: UserSummary | null;
  gameResults: GameResult[];
  isBye: boolean;
  reportedById: string | null;
};

type Round = {
  id: string;
  roundNumber: number;
  status: RoundStatus;
  matches: Match[];
};

type EventSeed = {
  id: string;
  userId: string;
  seedNum: number;
  user: UserSummary;
};

type StandingRow = {
  userId: string;
  points: number;
};

function countsFromGameResults(match: Match): MatchInputCounts {
  let player1Wins = 0;
  let player2Wins = 0;
  let gameDraws = 0;

  for (const game of match.gameResults) {
    if (game.isDraw || !game.winnerId) {
      gameDraws += 1;
      continue;
    }
    if (game.winnerId === match.player1.id) {
      player1Wins += 1;
      continue;
    }
    if (game.winnerId === match.player2?.id) {
      player2Wins += 1;
    }
  }

  return { player1Wins, player2Wins, gameDraws };
}

function toGameResultBody(match: Match, counts: MatchInputCounts) {
  const gameResults: Array<{ winnerId: string | null; isDraw: boolean }> = [];
  for (let i = 0; i < counts.player1Wins; i += 1) {
    gameResults.push({ winnerId: match.player1.id, isDraw: false });
  }
  for (let i = 0; i < counts.player2Wins; i += 1) {
    gameResults.push({ winnerId: match.player2?.id ?? null, isDraw: false });
  }
  for (let i = 0; i < counts.gameDraws; i += 1) {
    gameResults.push({ winnerId: null, isDraw: true });
  }
  return gameResults;
}

function matchResultSummary(match: Match) {
  const p1Name = primaryName(match.player1);
  if (match.isBye) {
    return `${p1Name} (BYE)`;
  }
  const p2Name = match.player2 ? primaryName(match.player2) : 'TBD';
  const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
  const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
  if (match.gameResults.length === 0) {
    return `${p1Name} vs ${p2Name}`;
  }
  return `${p1Name} ${p1Wins} - ${p2Wins} ${p2Name}`;
}

function matchResultVerdict(match: Match) {
  if (!['reported', 'confirmed', 'resolved'].includes(match.status) || match.gameResults.length === 0 || !match.player2) {
    return null;
  }
  const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
  const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
  if (p1Wins === p2Wins) {
    return { text: 'Match Draw.', tone: 'draw' as const };
  }
  const winner = p1Wins > p2Wins ? primaryName(match.player1) : primaryName(match.player2);
  return { text: `${winner} won.`, tone: 'winner' as const };
}

type PendingConfirmation =
  | { type: 'delete_event'; message: string }
  | { type: 'delete_round'; roundId: string; message: string }
  | null;

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [seeds, setSeeds] = useState<EventSeed[]>([]);
  const [seedInputs, setSeedInputs] = useState<Record<string, number>>({});
  const [seasonPoints, setSeasonPoints] = useState<Map<string, number>>(new Map());
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatchMode, setSelectedMatchMode] = useState<'report' | 'resolve' | null>(null);
  const [initialReportCounts, setInitialReportCounts] = useState<MatchInputCounts>({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);

  const isAdmin = user?.role === 'admin';
  const bestOfN = event?.config?.bestOfN ?? 3;

  const selectedMatch = useMemo(
    () => rounds.flatMap((round) => round.matches).find((match) => match.id === selectedMatchId) ?? null,
    [rounds, selectedMatchId],
  );

  const leagueMembers = useMemo(() => event?.season.league.memberships ?? [], [event]);
  const eventRecords = useMemo(() => computeEventRecords(rounds), [rounds]);

  const canEditSeeds = Boolean(
    isAdmin &&
      event?.status === 'setup' &&
      event?.config?.format === 'seeded_swiss' &&
      event?.config?.seedingSource === 'manual',
  );

  const loadEvent = async () => {
    if (!eventId) {
      return;
    }
    const [eventResponse, roundsResponse] = await Promise.all([
      apiRequest<ApiResponse<EventDetail>>(`/api/events/${eventId}`),
      apiRequest<ApiListResponse<Round>>(`/api/events/${eventId}/rounds`),
    ]);
    const standingsResponse = await apiRequest<ApiListResponse<StandingRow>>(`/api/standings/${eventResponse.data.season.id}`);

    setEvent(eventResponse.data);
    setRounds(roundsResponse.data);
    setSeasonPoints(new Map(standingsResponse.data.map((standing) => [standing.userId, standing.points])));

    if (eventResponse.data.config?.format === 'seeded_swiss' && eventResponse.data.config?.seedingSource === 'manual') {
      const seedResponse = await apiRequest<ApiListResponse<EventSeed>>(`/api/events/${eventId}/seeds`);
      setSeeds(seedResponse.data);
    } else {
      setSeeds([]);
    }
  };

  useEffect(() => {
    if (!eventId) {
      setError('Missing event id.');
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await loadEvent();
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load event details');
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [eventId]);

  useEffect(() => {
    if (!event || !canEditSeeds) {
      setSeedInputs({});
      return;
    }

    const seedMap = new Map(seeds.map((seed) => [seed.userId, seed.seedNum]));
    const nextInputs: Record<string, number> = {};
    leagueMembers.forEach((membership, index) => {
      nextInputs[membership.userId] = seedMap.get(membership.userId) ?? index + 1;
    });
    setSeedInputs(nextInputs);
  }, [canEditSeeds, event, leagueMembers, seeds]);

  const mutate = async (label: string, action: () => Promise<void>) => {
    setIsMutating(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await loadEvent();
      setSuccess(label);
    } catch (mutationError) {
      setError(mutationError instanceof ApiError ? mutationError.message : `Unable to ${label.toLowerCase()}`);
    } finally {
      setIsMutating(false);
    }
  };

  const transitionEvent = async (action: 'start' | 'complete') => {
    if (!eventId) {
      return;
    }
    await mutate(`Event ${action}ed.`, async () => {
      await apiRequest(`/api/events/${eventId}/${action}`, { method: 'POST' });
    });
  };

  const deleteEvent = async () => {
    if (!eventId) {
      return;
    }
    setIsMutating(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/events/${eventId}`, { method: 'DELETE' });
      navigate('/admin');
    } catch (mutationError) {
      setError(mutationError instanceof ApiError ? mutationError.message : 'Unable to delete event');
    } finally {
      setIsMutating(false);
    }
  };

  const createRound = async () => {
    if (!eventId) {
      return;
    }
    await mutate('Round created.', async () => {
      await apiRequest(`/api/events/${eventId}/rounds`, { method: 'POST' });
    });
  };

  const transitionRound = async (roundId: string, action: 'start' | 'complete' | 'regenerate') => {
    if (action === 'regenerate' && !window.confirm('Regenerate pairings for this round? Existing reports will be removed.')) {
      return;
    }
    await mutate(`Round ${action}ed.`, async () => {
      await apiRequest(`/api/rounds/${roundId}/${action}`, { method: 'POST' });
    });
  };

  const deleteRound = async (roundId: string) => {
    await mutate('Round deleted.', async () => {
      await apiRequest(`/api/rounds/${roundId}`, { method: 'DELETE' });
    });
  };

  const confirmDeleteEvent = () => {
    setPendingConfirmation({
      type: 'delete_event',
      message: 'Delete this event and all of its rounds/matches? This cannot be undone.',
    });
  };

  const confirmDeleteRound = (roundId: string) => {
    setPendingConfirmation({
      type: 'delete_round',
      roundId,
      message: 'Delete this round? This cannot be undone.',
    });
  };

  const runConfirmedAction = async () => {
    if (!pendingConfirmation) {
      return;
    }
    const action = pendingConfirmation;
    setPendingConfirmation(null);
    if (action.type === 'delete_event') {
      await deleteEvent();
      return;
    }
    await deleteRound(action.roundId);
  };

  const confirmOrDisputeMatch = async (matchId: string, action: 'confirm' | 'dispute') => {
    await mutate(`Match ${action}ed.`, async () => {
      await apiRequest(`/api/matches/${matchId}/${action}`, { method: 'POST' });
    });
  };

  const openMatchForm = (match: Match, mode: 'report' | 'resolve') => {
    setSelectedMatchId(match.id);
    setSelectedMatchMode(mode);
    if (mode === 'resolve') {
      setInitialReportCounts(countsFromGameResults(match));
      return;
    }
    setInitialReportCounts({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  };

  const closeMatchForm = () => {
    setSelectedMatchId(null);
    setSelectedMatchMode(null);
    setInitialReportCounts({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  };

  const submitMatchForm = async (reportCounts: MatchInputCounts) => {
    if (!selectedMatch || !selectedMatchMode) {
      return;
    }

    const payload = toGameResultBody(selectedMatch, reportCounts);
    const winsTotal = reportCounts.player1Wins + reportCounts.player2Wins;
    const requiredWins = Math.ceil(bestOfN / 2);
    if (!Number.isInteger(reportCounts.player1Wins) || !Number.isInteger(reportCounts.player2Wins) || !Number.isInteger(reportCounts.gameDraws)) {
      setError('Wins and draws must be whole numbers.');
      return;
    }
    if (payload.length === 0) {
      setError('Enter at least one game result before submitting.');
      return;
    }
    if (winsTotal > bestOfN) {
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

    const endpoint = selectedMatchMode === 'resolve' ? 'resolve' : 'report';
    await mutate(`Match ${endpoint}ed.`, async () => {
      await apiRequest(`/api/matches/${selectedMatch.id}/${endpoint}`, {
        method: 'POST',
        body: { gameResults: payload },
      });
    });
    closeMatchForm();
  };

  const saveSeeds = async () => {
    if (!eventId || !canEditSeeds) {
      return;
    }
    const payload = leagueMembers.map((membership) => ({
      userId: membership.userId,
      seedNum: Number(seedInputs[membership.userId]),
    }));
    if (payload.some((seed) => !Number.isInteger(seed.seedNum) || seed.seedNum <= 0)) {
      setError('Seed numbers must be positive integers.');
      return;
    }

    await mutate('Seeds saved.', async () => {
      await apiRequest(`/api/events/${eventId}/seeds`, {
        method: 'PUT',
        body: { seeds: payload },
      });
    });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading event details...</p>;
  }

  if (!event) {
    return <p className="text-sm text-destructive">{error ?? 'Event not found.'}</p>;
  }

  const hasRoundLimit = event.totalRounds !== null;
  const hasReachedRoundLimit = hasRoundLimit && rounds.length >= (event.totalRounds ?? 0);
  const allRoundsCompleted = rounds.length > 0 && rounds.every((round) => round.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link className="underline" to="/admin">
              Admin
            </Link>{' '}
            / Event
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {event.status} • {event.config?.format ?? 'unknown'} • Bo{event.config?.bestOfN ?? '-'} • x
            {event.pointMultiplier}
            {event.config?.seedingSource ? ` • Seeding: ${event.config.seedingSource}` : ''}
            {event.totalRounds !== null ? ` • Rounds: ${Math.min(rounds.length, event.totalRounds)} of ${event.totalRounds}` : ''}
          </p>
        </div>
        {event.status === 'completed' ? (
          <Link
            to={`/events/${event.id}/results`}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View Final Results
          </Link>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

      {isAdmin ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-lg font-semibold">Admin Controls</h2>
          <div className="flex flex-wrap gap-2">
            {event.status === 'setup' ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => void transitionEvent('start')}
                className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
              >
                Start Event
              </button>
            ) : null}
            {event.status === 'active' ? (
              <>
                {event.config?.format !== 'round_robin' && !hasReachedRoundLimit ? (
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => void createRound()}
                    className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
                  >
                    Create Next Round
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isMutating || rounds.some((round) => round.status !== 'completed')}
                  onClick={() => void transitionEvent('complete')}
                  className={`rounded-md px-3 py-2 text-sm disabled:opacity-60 ${
                    hasReachedRoundLimit && allRoundsCompleted
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border'
                  }`}
                >
                  Complete Event
                </button>
              </>
            ) : null}
            <button
              type="button"
              disabled={isMutating}
              onClick={confirmDeleteEvent}
              className="rounded-md border border-border px-3 py-2 text-sm text-destructive disabled:opacity-60"
            >
              Delete Event
            </button>
          </div>
        </div>
      ) : null}

      {isAdmin && event.status === 'active' && hasReachedRoundLimit && allRoundsCompleted ? (
        <div className="rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          All rounds complete - crown a winner and complete the event.
        </div>
      ) : null}

      {event.config?.format === 'seeded_swiss' && event.config.seedingSource === 'manual' ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-lg font-semibold">Manual Seeding</h2>
          {canEditSeeds ? (
            <>
              <div className="space-y-2">
                {leagueMembers.map((membership) => (
                  <label key={membership.userId} className="flex items-center justify-between gap-4 text-sm">
                    <span>{primaryName(membership.user)}</span>
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded-md border border-border bg-background px-2 py-1"
                      value={seedInputs[membership.userId] ?? ''}
                      onChange={(changeEvent) =>
                        setSeedInputs((prev) => ({
                          ...prev,
                          [membership.userId]: Number(changeEvent.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void saveSeeds()}
                disabled={isMutating}
                className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
              >
                Save Seeds
              </button>
            </>
          ) : (
            <div className="space-y-2 text-sm">
              {seeds.length === 0 ? (
                <p className="text-muted-foreground">No seeds have been saved yet.</p>
              ) : (
                seeds.map((seed) => (
                  <p key={seed.id}>
                    #{seed.seedNum} {primaryName(seed.user)}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="text-lg font-semibold">Rounds</h2>
        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rounds yet. An admin can create the first round.</p>
        ) : (
          <div className="space-y-4">
            {rounds.map((round) => (
              <details key={round.id} className="rounded-md border border-border p-3" open>
                {(() => {
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
                    <>
                <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium">
                    Round {round.roundNumber}
                    {event.totalRounds !== null ? ` of ${event.totalRounds}` : ''}{' '}
                    {event.totalRounds !== null && round.roundNumber === event.totalRounds ? (
                      <span className="ml-2 rounded-full bg-amber-500/15 border border-amber-600 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Last Round
                      </span>
                    ) : null}{' '}
                    <span className="text-xs text-muted-foreground">({round.status.replace('_', ' ')})</span>
                  </span>
                  {isAdmin ? (
                    <span className="flex gap-2">
                      {round.status === 'not_started' ? (
                        <>
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs"
                            disabled={isMutating}
                            onClick={(clickEvent) => {
                              clickEvent.preventDefault();
                              void transitionRound(round.id, 'start');
                            }}
                          >
                            Start Round
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs"
                            disabled={isMutating}
                            onClick={(clickEvent) => {
                              clickEvent.preventDefault();
                              void transitionRound(round.id, 'regenerate');
                            }}
                          >
                            Regenerate Pairings
                          </button>
                        </>
                      ) : null}
                      {round.status === 'in_progress' ? (
                        <button
                          type="button"
                          className={`rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                            canCompleteRound
                              ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-300'
                              : 'border-amber-600 bg-amber-600/10 text-amber-700 dark:text-amber-300'
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                          disabled={isMutating || !canCompleteRound}
                          title={roundBlockedReason ?? (reportedCount > 0 ? `Ready: will auto-confirm ${reportedCount} reported match(es).` : 'Ready to complete this round.')}
                          onClick={(clickEvent) => {
                            clickEvent.preventDefault();
                            clickEvent.stopPropagation();
                            void transitionRound(round.id, 'complete');
                          }}
                        >
                          Complete Round
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </summary>

                <div className="mt-3 space-y-2">
                  {isAdmin && round.status === 'in_progress' ? (
                    <div
                      className={`rounded-md border px-2 py-1 text-xs ${
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
                  {isAdmin && ['in_progress', 'completed'].includes(round.status) ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs text-destructive"
                        disabled={isMutating}
                        onClick={() => confirmDeleteRound(round.id)}
                      >
                        Delete Round
                      </button>
                    </div>
                  ) : null}
                  {round.matches.map((match) => {
                    const isParticipant = Boolean(user && (match.player1.id === user.id || match.player2?.id === user.id));
                    const canReport = (isParticipant || isAdmin) && match.status === 'pending' && round.status === 'in_progress';
                    const canConfirmOrDispute = isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
                    const canResolve = isAdmin && match.status === 'disputed';
                    const verdict = matchResultVerdict(match);

                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        eventRecords={eventRecords}
                        seasonPoints={seasonPoints}
                        footer={
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground capitalize">{match.status.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">{matchResultSummary(match)}</p>
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
                                onClick={() => openMatchForm(match, 'report')}
                              >
                                Report
                              </button>
                            ) : null}
                            {canConfirmOrDispute ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded-md border border-border px-2 py-1 text-xs"
                                  onClick={() => void confirmOrDisputeMatch(match.id, 'confirm')}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-border px-2 py-1 text-xs"
                                  onClick={() => void confirmOrDisputeMatch(match.id, 'dispute')}
                                >
                                  Dispute
                                </button>
                              </>
                            ) : null}
                            {canResolve ? (
                              <button
                                type="button"
                                className="rounded-md border border-border px-2 py-1 text-xs"
                                onClick={() => openMatchForm(match, 'resolve')}
                              >
                                Resolve
                              </button>
                            ) : null}
                          </>
                        }
                      />
                    );
                  })}
                </div>
                    </>
                  );
                })()}
              </details>
            ))}
          </div>
        )}
      </div>

      {selectedMatch && selectedMatchMode ? (
        <ReportMatchDialog
          match={selectedMatch}
          bestOfN={bestOfN}
          mode={selectedMatchMode}
          initialCounts={initialReportCounts}
          isMutating={isMutating}
          onClose={closeMatchForm}
          onSubmit={submitMatchForm}
        />
      ) : null}

      {pendingConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="text-lg font-semibold">Confirm Delete</h3>
            <p className="text-sm text-muted-foreground">{pendingConfirmation.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => setPendingConfirmation(null)}
                disabled={isMutating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive"
                onClick={() => void runConfirmedAction()}
                disabled={isMutating}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
