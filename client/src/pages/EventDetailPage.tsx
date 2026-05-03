import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiRequest } from '@/lib/api';
import { MatchCard } from '@/components/MatchCard';
import { computeEventRecords } from '@/lib/eventRecords';
import { primaryName } from '@/lib/userDisplay';

type ApiResponse<T> = { data: T };
type ApiListResponse<T> = { data: T[] };

type EventStatus = 'setup' | 'active' | 'completed';
type RoundStatus = 'not_started' | 'in_progress' | 'completed';
type MatchStatus = 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
type SeedingSource = 'previous_season' | 'previous_event' | 'manual' | null;
type MatchInputCounts = { player1Wins: number; player2Wins: number; gameDraws: number };

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
  const [reportCounts, setReportCounts] = useState<MatchInputCounts>({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const reportInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!selectedMatch || !selectedMatchMode) {
      return;
    }
    reportInputRef.current?.focus();
  }, [selectedMatch, selectedMatchMode]);

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
      setReportCounts(countsFromGameResults(match));
      return;
    }
    setReportCounts({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  };

  const closeMatchForm = () => {
    setSelectedMatchId(null);
    setSelectedMatchMode(null);
    setReportCounts({ player1Wins: 0, player2Wins: 0, gameDraws: 0 });
  };

  const submitMatchForm = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!selectedMatch || !selectedMatchMode) {
      return;
    }

    const payload = toGameResultBody(selectedMatch, reportCounts);
    if (!Number.isInteger(reportCounts.player1Wins) || !Number.isInteger(reportCounts.player2Wins) || !Number.isInteger(reportCounts.gameDraws)) {
      setError('Wins and draws must be whole numbers.');
      return;
    }
    if (payload.length === 0) {
      setError('Enter at least one game result before submitting.');
      return;
    }
    if (payload.length > bestOfN) {
      setError(`Total games cannot exceed best-of-${bestOfN}.`);
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

  const score = reportCounts;
  const totalGames = reportCounts.player1Wins + reportCounts.player2Wins + reportCounts.gameDraws;
  const requiredWins = Math.ceil(bestOfN / 2);

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
          </p>
        </div>
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
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void createRound()}
                  className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
                >
                  Create Next Round
                </button>
                <button
                  type="button"
                  disabled={isMutating || rounds.some((round) => round.status !== 'completed')}
                  onClick={() => void transitionEvent('complete')}
                  className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
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
                <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium">
                    Round {round.roundNumber}{' '}
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
                          className="rounded-md border border-border px-2 py-1 text-xs"
                          disabled={isMutating || round.matches.some((match) => !['confirmed', 'resolved'].includes(match.status))}
                          onClick={(clickEvent) => {
                            clickEvent.preventDefault();
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
                    const canReport = (isParticipant || isAdmin) && match.status === 'pending';
                    const canConfirmOrDispute = isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
                    const canResolve = isAdmin && match.status === 'disputed';

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
              </details>
            ))}
          </div>
        )}
      </div>

      {selectedMatch && selectedMatchMode ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close report dialog"
            className="absolute inset-0 bg-black/70"
            onClick={closeMatchForm}
            disabled={isMutating}
          />
          <form
            onSubmit={submitMatchForm}
            className="relative w-full max-w-2xl rounded-lg border border-border bg-card p-4 space-y-3 shadow-lg"
          >
            <h2 className="text-lg font-semibold">{selectedMatchMode === 'resolve' ? 'Resolve Match' : 'Report Match'}</h2>
            <p className="text-sm text-muted-foreground">
              {primaryName(selectedMatch.player1)} vs {selectedMatch.player2 ? primaryName(selectedMatch.player2) : 'TBD'}
            </p>
            <p className="text-xs text-muted-foreground">
              Score: {score.player1Wins} - {score.player2Wins} • Draws: {score.gameDraws} (first to {requiredWins})
            </p>
            <p className="text-xs text-muted-foreground">Total games: {totalGames} / {bestOfN}</p>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                {primaryName(selectedMatch.player1)} wins
                <input
                  ref={reportInputRef}
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={reportCounts.player1Wins}
                  onChange={(changeEvent) =>
                    setReportCounts((prev) => ({
                      ...prev,
                      player1Wins: Math.max(0, Number(changeEvent.target.value) || 0),
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
                  onChange={(changeEvent) =>
                    setReportCounts((prev) => ({
                      ...prev,
                      player2Wins: Math.max(0, Number(changeEvent.target.value) || 0),
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
                  onChange={(changeEvent) =>
                    setReportCounts((prev) => ({
                      ...prev,
                      gameDraws: Math.max(0, Number(changeEvent.target.value) || 0),
                    }))
                  }
                />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isMutating}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {selectedMatchMode === 'resolve' ? 'Submit Resolution' : 'Submit Report'}
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm"
                onClick={closeMatchForm}
                disabled={isMutating}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
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
