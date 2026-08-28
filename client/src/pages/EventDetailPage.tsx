import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { ApiError, apiRequest, authApiRequest } from '@/lib/api';
import { MatchCard } from '@/components/MatchCard';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useScryfallSets } from '@/hooks/useScryfallSets';
import { useSeasonPoolSets } from '@/hooks/useSeasonPoolSets';
import { computeEventRecords } from '@/lib/eventRecords';
import { formatActiveRoundLabel, getUserActiveMatches } from '@/lib/activeMatches';
import { getBracketMatchInteraction, isBracketMatchClickable as canClickBracketMatch } from '@/lib/bracketMatchInteraction';
import { confirmDisputeMatch } from '@/lib/matchDisputeConfirm';
import { primaryName } from '@/lib/userDisplay';
import { ReportMatchDialog } from '@/components/ReportMatchDialog';
import {
  type MatchInputCounts,
  parseGameResultsToCounts,
  toGameResultBody,
  validateReportCounts,
} from '@/lib/matchReporting';
import { BracketView } from '@/components/bracket/BracketView';
import type { BracketSlotView } from '@/components/bracket/types';
import { fetchBracketState } from '@/lib/bracketApi';
import { isBracketFormat, supportsRegeneratePairings } from '@mtg-league/shared';
import { type DraftPairing, validateDraftPairings } from '@/lib/pairingValidation';
import { minDeckSizeSelectOptions } from '@/lib/minDeckSize';

type ApiResponse<T> = { data: T };
type ApiListResponse<T> = { data: T[] };

type EventStatus = 'setup' | 'active' | 'completed';
type RoundStatus = 'not_started' | 'in_progress' | 'completed';
type MatchStatus = 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
type SeedingSource = 'previous_season' | 'previous_event' | 'current_season' | 'manual' | null;
type EventConfig = {
  format: 'swiss' | 'seeded_swiss' | 'round_robin' | 'single_elimination' | 'double_elimination' | 'custom_10_player';
  bestOfN: number;
  deckCount: number;
  minDeckSize: number;
  sideboardRule: 'entire_pool' | 'fixed_15' | 'none';
  schedulingType: 'fixed_deadlines' | 'open_window' | 'weekly_auto';
  deckLockingMode: 'required_before_round' | 'free_modification' | 'admin_locked';
  seedingSource: SeedingSource;
  grandFinalsReset?: boolean;
};

const defaultEventConfig: EventConfig = {
  format: 'swiss',
  bestOfN: 3,
  deckCount: 1,
  minDeckSize: 40,
  sideboardRule: 'entire_pool',
  schedulingType: 'open_window',
  deckLockingMode: 'free_modification',
  seedingSource: null,
  grandFinalsReset: false,
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
  standingsOverride?: boolean;
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

function matchResultRecord(match: Match) {
  if (!['reported', 'confirmed', 'resolved'].includes(match.status) || match.gameResults.length === 0 || !match.player2) {
    return null;
  }
  const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
  const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
  return `${p1Wins}-${p2Wins}`;
}

function matchResultVerdict(match: Match) {
  if (!['reported', 'confirmed', 'resolved'].includes(match.status) || match.gameResults.length === 0 || !match.player2) {
    return null;
  }
  const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
  const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
  if (p1Wins === p2Wins) {
    return { text: 'Match ended in a draw.', tone: 'draw' as const };
  }
  const winner = p1Wins > p2Wins ? primaryName(match.player1) : primaryName(match.player2);
  return { text: `${winner} won.`, tone: 'winner' as const };
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const { league, activeSeason } = useCurrentLeague();
  const { poolSetsByUserId, isLoading: poolSetsLoading } = useSeasonPoolSets(league?.slug, activeSeason?.number);
  const { getSet } = useScryfallSets();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [bracketSlots, setBracketSlots] = useState<BracketSlotView[]>([]);
  const [seeds, setSeeds] = useState<EventSeed[]>([]);
  const [seedInputs, setSeedInputs] = useState<Record<string, number>>({});
  const [seasonPoints, setSeasonPoints] = useState<Map<string, number>>(new Map());
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatchMode, setSelectedMatchMode] = useState<'report' | 'resolve' | null>(null);
  const [initialReportCounts, setInitialReportCounts] = useState<MatchInputCounts>({ player1Wins: 0, player2Wins: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [draftPairings, setDraftPairings] = useState<DraftPairing[]>([]);
  const [editSettingsForm, setEditSettingsForm] = useState({
    name: '',
    pointMultiplier: 1,
    standingsOverride: false,
    config: defaultEventConfig,
  });

  const isAdmin = user?.role === 'admin';
  const bestOfN = event?.config?.bestOfN ?? 3;

  const selectedMatch = useMemo(
    () => rounds.flatMap((round) => round.matches).find((match) => match.id === selectedMatchId) ?? null,
    [rounds, selectedMatchId],
  );

  const leagueMembers = useMemo(() => event?.season.league.memberships ?? [], [event]);
  const leagueMemberIds = useMemo(() => leagueMembers.map((membership) => membership.userId), [leagueMembers]);
  const draftPairingValidation = useMemo(
    () => validateDraftPairings(draftPairings, leagueMemberIds),
    [draftPairings, leagueMemberIds],
  );
  const memberNameById = useMemo(
    () => new Map(leagueMembers.map((membership) => [membership.userId, primaryName(membership.user)])),
    [leagueMembers],
  );
  const eventRecords = useMemo(() => computeEventRecords(rounds), [rounds]);
  const userActiveMatches = useMemo(() => getUserActiveMatches<Match, Round>(rounds, user?.id), [rounds, user?.id]);
  const orderedRounds = useMemo(() => {
    const priority = (status: RoundStatus) => {
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
    if (eventResponse.data.config?.format && isBracketFormat(eventResponse.data.config.format)) {
      setBracketSlots(await fetchBracketState(eventId));
    } else {
      setBracketSlots([]);
    }

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
    if (!event || !event.config) {
      setEditSettingsForm({
        name: '',
        pointMultiplier: 1,
        standingsOverride: false,
        config: defaultEventConfig,
      });
      return;
    }

    setEditSettingsForm({
      name: event.name,
      pointMultiplier: event.pointMultiplier,
      standingsOverride: event.standingsOverride ?? false,
      config: {
        format: event.config.format,
        bestOfN: event.config.bestOfN,
        deckCount: event.config.deckCount,
        minDeckSize: event.config.minDeckSize,
        sideboardRule: event.config.sideboardRule,
        schedulingType: event.config.schedulingType,
        deckLockingMode: event.config.deckLockingMode,
        seedingSource: event.config.seedingSource,
        grandFinalsReset: event.config.grandFinalsReset ?? false,
      },
    });
  }, [event]);

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

  const startEditRoundPairings = (round: Round) => {
    setEditingRoundId(round.id);
    setDraftPairings(
      round.matches.map((match) => ({
        draftId: crypto.randomUUID(),
        matchId: match.id,
        player1Id: match.player1.id,
        player2Id: match.isBye || !match.player2 ? null : match.player2.id,
      })),
    );
  };

  const cancelEditRoundPairings = () => {
    setEditingRoundId(null);
    setDraftPairings([]);
  };

  const addDraftPairing = () => {
    const unpaired = draftPairingValidation.unpairedMembers;
    const player1Id = unpaired[0] ?? leagueMemberIds[0] ?? '';
    const player2Id = unpaired.length > 1 ? unpaired[1] : leagueMemberIds[1] ?? null;

    setDraftPairings((current) => [
      ...current,
      {
        draftId: crypto.randomUUID(),
        player1Id,
        player2Id,
      },
    ]);
  };

  const removeDraftPairing = (draftId: string) => {
    setDraftPairings((current) => current.filter((pairing) => pairing.draftId !== draftId));
  };

  const updateDraftPairing = (draftId: string, field: 'player1Id' | 'player2Id', value: string | null) => {
    setDraftPairings((current) =>
      current.map((pairing) =>
        pairing.draftId === draftId
          ? { ...pairing, [field]: value }
          : pairing,
      ),
    );
  };

  const saveEditRoundPairings = async (roundId: string) => {
    if (!draftPairingValidation.isValid) {
      return;
    }

    if (draftPairingValidation.unpairedMembers.length > 0) {
      const unpairedNames = draftPairingValidation.unpairedMembers
        .map((memberId) => memberNameById.get(memberId) ?? memberId)
        .join(', ');

      const confirmed = await confirm({
        title: 'Save with unpaired players?',
        message: `The following players are not in any pairing: ${unpairedNames}. Save anyway?`,
        confirmLabel: 'Save All',
        variant: 'default',
      });

      if (!confirmed) {
        return;
      }
    }

    await mutate('Pairings updated.', async () => {
      await authApiRequest(`/api/rounds/${roundId}/pairings`, {
        method: 'PUT',
        body: {
          pairings: draftPairings.map(({ matchId, player1Id, player2Id }) => ({
            ...(matchId ? { matchId } : {}),
            player1Id,
            player2Id,
          })),
        },
      });
      cancelEditRoundPairings();
    });
  };

  const transitionEvent = async (action: 'start' | 'complete') => {
    if (!eventId) {
      return;
    }
    await mutate(`Event ${action}ed.`, async () => {
      await authApiRequest(`/api/events/${eventId}/${action}`, { method: 'POST' });
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
      await authApiRequest(`/api/events/${eventId}`, { method: 'DELETE' });
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
      await authApiRequest(`/api/events/${eventId}/rounds`, { method: 'POST' });
    });
  };

  const transitionRound = async (roundId: string, action: 'start' | 'complete' | 'regenerate') => {
    if (action === 'regenerate') {
      const confirmed = await confirm({
        title: 'Regenerate pairings',
        message: 'Regenerate pairings for this round? Existing reports will be removed.',
        confirmLabel: 'Regenerate',
        variant: 'destructive',
      });
      if (!confirmed) {
        return;
      }
    }
    await mutate(`Round ${action}ed.`, async () => {
      await authApiRequest(`/api/rounds/${roundId}/${action}`, { method: 'POST' });
    });
  };

  const deleteRound = async (roundId: string) => {
    await mutate('Round deleted.', async () => {
      await authApiRequest(`/api/rounds/${roundId}`, { method: 'DELETE' });
    });
  };

  const saveEventSettings = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!eventId || !event || event.status !== 'setup') {
      return;
    }

    await mutate('Event settings saved.', async () => {
      await authApiRequest(`/api/events/${eventId}`, {
        method: 'PATCH',
        body: {
          name: editSettingsForm.name.trim(),
          pointMultiplier: editSettingsForm.pointMultiplier,
          standingsOverride: editSettingsForm.standingsOverride,
          config: editSettingsForm.config,
        },
      });
    });
    setIsEditingSettings(false);
  };

  const confirmResetEvent = async () => {
    if (!eventId || !event || !['active', 'completed'].includes(event.status)) {
      return;
    }
    const confirmed = await confirm({
      title: 'Reset event',
      message:
        'Unstart this event, reset all rounds, unlock all decks, and clear match progress? Event settings are kept; players must re-register decks.',
      confirmLabel: 'Reset Event',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    await mutate('Event reset.', async () => {
      await authApiRequest(`/api/events/${eventId}/reset`, { method: 'POST' });
    });
  };

  const confirmResetRound = async (roundId: string) => {
    const confirmed = await confirm({
      title: 'Reset round',
      message: 'Clear all match results for this round, unlock decks, and return the round to not started? Pairings will be regenerated.',
      confirmLabel: 'Reset Round',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    await mutate('Round reset.', async () => {
      await authApiRequest(`/api/rounds/${roundId}/reset`, { method: 'POST' });
    });
  };

  const confirmDeleteEvent = async () => {
    const confirmed = await confirm({
      title: 'Confirm Delete',
      message: 'Delete this event and all of its rounds/matches? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (confirmed) {
      await deleteEvent();
    }
  };

  const confirmDeleteRound = async (roundId: string) => {
    const confirmed = await confirm({
      title: 'Confirm Delete',
      message: 'Delete this round? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (confirmed) {
      await deleteRound(roundId);
    }
  };

  const confirmOrDisputeMatch = async (matchId: string, action: 'confirm' | 'dispute') => {
    if (action === 'dispute' && !(await confirmDisputeMatch(confirm))) {
      return;
    }
    await mutate(`Match ${action}ed.`, async () => {
      await authApiRequest(`/api/matches/${matchId}/${action}`, { method: 'POST' });
    });
  };

  const openMatchForm = (match: Match, mode: 'report' | 'resolve') => {
    setSelectedMatchId(match.id);
    setSelectedMatchMode(mode);
    if (mode === 'resolve') {
      setInitialReportCounts(parseGameResultsToCounts(match.player1.id, match.gameResults));
      return;
    }
    setInitialReportCounts({ player1Wins: 0, player2Wins: 0 });
  };

  const closeMatchForm = () => {
    setSelectedMatchId(null);
    setSelectedMatchMode(null);
    setInitialReportCounts({ player1Wins: 0, player2Wins: 0 });
  };

  const submitMatchForm = async (reportCounts: MatchInputCounts) => {
    if (!selectedMatch || !selectedMatchMode) {
      return;
    }

    const validationError = validateReportCounts(reportCounts, bestOfN);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!selectedMatch.player2) {
      setError('Both players are required to report a match.');
      return;
    }

    const payload = toGameResultBody(
      selectedMatch.player1.id,
      selectedMatch.player2.id,
      reportCounts,
    );

    const endpoint = selectedMatchMode === 'resolve' ? 'resolve' : 'report';
    await mutate(`Match ${endpoint}ed.`, async () => {
      await authApiRequest(`/api/matches/${selectedMatch.id}/${endpoint}`, {
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
      await authApiRequest(`/api/events/${eventId}/seeds`, {
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

  const isBracketEvent = Boolean(event.config?.format && isBracketFormat(event.config.format));
  const roundLimit =
    typeof event.totalRounds === 'number'
      ? event.totalRounds
      : event.config?.format === 'round_robin'
        ? rounds.length
        : null;
  const hasRoundLimit = typeof roundLimit === 'number' && roundLimit > 0 && !isBracketEvent;
  const hasReachedRoundLimit = hasRoundLimit && rounds.length >= (roundLimit ?? 0);
  const allRoundsCompleted = rounds.length > 0 && rounds.every((round) => round.status === 'completed');
  const showActiveMatchesSection = Boolean(
    user && event.status === 'active' && isBracketEvent && userActiveMatches.length > 0,
  );
  const bracketMatchClickable = (matchId: string) => {
    const round = rounds.find((candidate) => candidate.matches.some((match) => match.id === matchId));
    const match = round?.matches.find((candidate) => candidate.id === matchId);
    if (!match || !round) {
      return false;
    }
    return canClickBracketMatch(match, round, user?.id, isAdmin);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? (
              <>
                <Link className="underline" to="/admin">
                  Admin
                </Link>{' '}
                / Event
              </>
            ) : (
              'Event'
            )}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {event.status} • {event.config?.format ?? 'unknown'} • Bo{event.config?.bestOfN ?? '-'} • x
            {event.pointMultiplier}
            {typeof event.config?.deckCount === 'number' ? ` • Decks ${event.config.deckCount}` : ''}
            {typeof event.config?.minDeckSize === 'number' ? ` • Min ${event.config.minDeckSize}` : ''}
            {event.config?.seedingSource ? ` • Seeding: ${event.config.seedingSource}` : ''}
            {hasRoundLimit ? ` • Rounds: ${Math.min(rounds.length, roundLimit ?? 0)} of ${roundLimit}` : ''}
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
              <>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setIsEditingSettings((prev) => !prev)}
                  className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
                >
                  {isEditingSettings ? 'Cancel Edit' : 'Edit Settings'}
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void transitionEvent('start')}
                  className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
                >
                  Start Event
                </button>
              </>
            ) : null}
            {event.status === 'active' ? (
              <>
                {event.config?.format && !isBracketFormat(event.config.format) && event.config.format !== 'round_robin' && !hasReachedRoundLimit ? (
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
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void confirmResetEvent()}
                  className="rounded-md border border-border px-3 py-2 text-sm text-destructive disabled:opacity-60"
                >
                  Reset Event
                </button>
              </>
            ) : null}
            {event.status === 'completed' ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => void confirmResetEvent()}
                className="rounded-md border border-border px-3 py-2 text-sm text-destructive disabled:opacity-60"
              >
                Reset Event
              </button>
            ) : null}
            {event.status === 'setup' || event.status === 'active' ? (
              <Link
                to={`/admin/deck-checks?seasonId=${event.season.id}`}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Deck checks
              </Link>
            ) : null}
            <button
              type="button"
              disabled={isMutating}
              onClick={() => void confirmDeleteEvent()}
              className="rounded-md border border-border px-3 py-2 text-sm text-destructive disabled:opacity-60"
            >
              Delete Event
            </button>
          </div>
          {isEditingSettings && event.status === 'setup' ? (
            <form className="grid gap-3 md:grid-cols-3" onSubmit={saveEventSettings}>
              <label className="text-sm font-medium">
                Event Name
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.name}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      name: changeEvent.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Format
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.config.format}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        format: changeEvent.target.value as EventConfig['format'],
                      },
                    }))
                  }
                >
                  <option value="swiss">Swiss</option>
                  <option value="seeded_swiss">Seeded Swiss</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                  <option value="custom_10_player">Custom 10 Player</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Best Of
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.config.bestOfN}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        bestOfN: Number(changeEvent.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Deck Count
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.config.deckCount}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        deckCount: Number(changeEvent.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Min Deck Size
                <select
                  data-testid="min-deck-size-select"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.config.minDeckSize}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        minDeckSize: Number(changeEvent.target.value),
                      },
                    }))
                  }
                >
                  {minDeckSizeSelectOptions(editSettingsForm.config.minDeckSize).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Point Multiplier
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.pointMultiplier}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      pointMultiplier: Number(changeEvent.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Sideboard Rule
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.config.sideboardRule}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        sideboardRule: changeEvent.target.value as EventConfig['sideboardRule'],
                      },
                    }))
                  }
                >
                  <option value="entire_pool">Entire Pool</option>
                  <option value="fixed_15">Fixed 15</option>
                  <option value="none">None</option>
                </select>
              </label>
              {!isBracketFormat(editSettingsForm.config.format) ? (
                <>
                  <label className="text-sm font-medium">
                    Scheduling Type
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={editSettingsForm.config.schedulingType}
                      onChange={(changeEvent) =>
                        setEditSettingsForm((prev) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            schedulingType: changeEvent.target.value as EventConfig['schedulingType'],
                          },
                        }))
                      }
                    >
                      <option value="fixed_deadlines">Fixed Deadlines</option>
                      <option value="open_window">Open Window</option>
                      <option value="weekly_auto">Weekly Auto</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Deck Locking Mode
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={editSettingsForm.config.deckLockingMode}
                      onChange={(changeEvent) =>
                        setEditSettingsForm((prev) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            deckLockingMode: changeEvent.target.value as EventConfig['deckLockingMode'],
                          },
                        }))
                      }
                    >
                      <option value="required_before_round">Required Before Round</option>
                      <option value="free_modification">Free Modification</option>
                      <option value="admin_locked">Admin Locked</option>
                    </select>
                  </label>
                </>
              ) : null}
              <label className="text-sm font-medium">
                Seeding Source
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editSettingsForm.config.seedingSource ?? ''}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        seedingSource: (changeEvent.target.value || null) as EventConfig['seedingSource'],
                      },
                    }))
                  }
                >
                  <option value="">None</option>
                  <option value="current_season">Current Season Standings</option>
                  <option value="previous_season">Prior Season Standings</option>
                  <option value="previous_event">Previous Event in This Season</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              {['double_elimination', 'custom_10_player'].includes(editSettingsForm.config.format) ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(editSettingsForm.config.grandFinalsReset)}
                    onChange={(changeEvent) =>
                      setEditSettingsForm((prev) => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          grandFinalsReset: changeEvent.target.checked,
                        },
                      }))
                    }
                  />
                  Grand Finals Reset
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm md:col-span-3">
                <input
                  type="checkbox"
                  checked={editSettingsForm.standingsOverride}
                  onChange={(changeEvent) =>
                    setEditSettingsForm((prev) => ({
                      ...prev,
                      standingsOverride: changeEvent.target.checked,
                    }))
                  }
                />
                Standings Override
              </label>
              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  disabled={isMutating}
                >
                  Save Settings
                </button>
              </div>
            </form>
          ) : null}
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

      {showActiveMatchesSection ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Your Active Matches</h2>
            <p className="text-sm text-muted-foreground">Report or confirm bracket matches you can play now.</p>
          </div>
          <div className="space-y-4">
            {userActiveMatches.map(({ match, round }) => {
              const isParticipant = Boolean(user && (match.player1.id === user.id || match.player2?.id === user.id));
              const canReport = (isParticipant || isAdmin) && match.status === 'pending' && round.status === 'in_progress';
              const canConfirmOrDispute = isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
              const record = matchResultRecord(match);
              const verdict = matchResultVerdict(match);

              return (
                <div key={match.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {formatActiveRoundLabel(round.roundNumber, event.config?.format)}
                  </p>
                  <MatchCard
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
                      </>
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isBracketEvent ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-lg font-semibold">Bracket</h2>
          {bracketSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bracket will appear after the event starts.</p>
          ) : (
            <BracketView
              slots={bracketSlots}
              isMatchClickable={bracketMatchClickable}
              onMatchClick={(matchId) => {
                const round = rounds.find((candidate) => candidate.matches.some((match) => match.id === matchId));
                const match = round?.matches.find((candidate) => candidate.id === matchId);
                if (!match || !round) {
                  return;
                }

                const interaction = getBracketMatchInteraction(match, round, user?.id, isAdmin);
                if (interaction === 'resolve') {
                  openMatchForm(match, 'resolve');
                  return;
                }
                if (interaction === 'report') {
                  openMatchForm(match, 'report');
                }
              }}
            />
          )}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="text-lg font-semibold">Rounds</h2>
        {rounds.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {event.status === 'completed'
                ? 'No rounds are available for this event.'
                : 'No rounds yet. Pairings will be generated when the admin creates the first round.'}
            </p>
            {event.status === 'setup' || event.status === 'active' ? (
              <Link
                to={`/events/${event.id}/build`}
                className="inline-flex rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                Build Deck
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {orderedRounds.map((round) => (
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
                    {formatActiveRoundLabel(round.roundNumber, event.config?.format)}
                    {hasRoundLimit && !isBracketEvent ? ` of ${roundLimit}` : ''}{' '}
                    {hasRoundLimit && !isBracketEvent && round.roundNumber === roundLimit ? (
                      <span className="ml-2 rounded-full bg-amber-500/15 border border-amber-600 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Last Round
                      </span>
                    ) : null}{' '}
                    <span className="text-xs text-muted-foreground">({round.status.replace('_', ' ')})</span>
                  </span>
                  <span className="flex gap-2">
                    <Link
                      to={`/events/${event.id}/build`}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={(clickEvent) => clickEvent.stopPropagation()}
                    >
                      Build Deck
                    </Link>
                  {isAdmin && !isBracketEvent ? (
                    <>
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
                          {supportsRegeneratePairings(event.config?.format ?? '') ? (
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
                          ) : null}
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs"
                            disabled={isMutating}
                            onClick={(clickEvent) => {
                              clickEvent.preventDefault();
                              startEditRoundPairings(round);
                            }}
                          >
                            Edit Pairings
                          </button>
                        </>
                      ) : null}
                      {round.status === 'in_progress' ? (
                        <>
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
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs text-destructive"
                            disabled={isMutating}
                            onClick={(clickEvent) => {
                              clickEvent.preventDefault();
                              clickEvent.stopPropagation();
                              void confirmResetRound(round.id);
                            }}
                          >
                            Reset Round
                          </button>
                        </>
                      ) : null}
                      {round.status === 'completed' ? (
                        <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1 text-xs text-destructive"
                          disabled={isMutating}
                          onClick={(clickEvent) => {
                            clickEvent.preventDefault();
                            clickEvent.stopPropagation();
                            void confirmResetRound(round.id);
                          }}
                        >
                          Reset Round
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  </span>
                </summary>

                <div className="mt-3 space-y-2">
                  {isAdmin && !isBracketEvent && round.status === 'in_progress' ? (
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
                  {isAdmin && !isBracketEvent && ['in_progress', 'completed'].includes(round.status) ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs text-destructive"
                        disabled={isMutating}
                        onClick={() => void confirmDeleteRound(round.id)}
                      >
                        Delete Round
                      </button>
                    </div>
                  ) : null}
                  {editingRoundId === round.id ? (
                    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">Edit pairings</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs"
                            disabled={isMutating || !draftPairingValidation.isValid}
                            onClick={() => void saveEditRoundPairings(round.id)}
                          >
                            Save All
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs"
                            disabled={isMutating}
                            onClick={cancelEditRoundPairings}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>

                      {draftPairingValidation.duplicatePlayers.size > 0 ? (
                        <div className="rounded-md border border-red-600/40 bg-red-600/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                          Double-booked:{' '}
                          {[...draftPairingValidation.duplicatePlayers.keys()]
                            .map((playerId) => memberNameById.get(playerId) ?? playerId)
                            .join(', ')}
                        </div>
                      ) : !draftPairingValidation.isValid ? null : draftPairingValidation.unpairedMembers.length > 0 ? (
                        <div className="rounded-md border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                          No duplicate pairings. You can save with unpaired players and finish assignments later.
                        </div>
                      ) : (
                        <div className="rounded-md border border-emerald-600/40 bg-emerald-600/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                          Pairings look good.
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="pb-2 pr-3 font-medium">Match</th>
                              <th className="pb-2 pr-3 font-medium">Player 1</th>
                              <th className="pb-2 pr-3 font-medium">Player 2</th>
                              <th className="pb-2 font-medium" />
                            </tr>
                          </thead>
                          <tbody>
                            {draftPairings.map((pairing, index) => {
                              const hasSamePlayerError = draftPairingValidation.samePlayerMatches.has(pairing.draftId);
                              const player1Duplicate = draftPairingValidation.duplicatePlayers.has(pairing.player1Id);
                              const player2Duplicate = pairing.player2Id
                                ? draftPairingValidation.duplicatePlayers.has(pairing.player2Id)
                                : false;

                              return (
                                <tr key={pairing.draftId} className="border-t border-border align-top">
                                  <td className="py-2 pr-3 text-xs text-muted-foreground">#{index + 1}</td>
                                  <td className="py-2 pr-3">
                                    <select
                                      className={`w-full rounded-md border bg-background px-2 py-1 text-sm ${
                                        player1Duplicate ? 'border-red-600' : 'border-border'
                                      }`}
                                      value={pairing.player1Id}
                                      onChange={(event) => updateDraftPairing(pairing.draftId, 'player1Id', event.target.value)}
                                    >
                                      {leagueMembers.map((membership) => (
                                        <option key={membership.userId} value={membership.userId}>
                                          {primaryName(membership.user)}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 pr-3">
                                    <select
                                      className={`w-full rounded-md border bg-background px-2 py-1 text-sm ${
                                        player2Duplicate ? 'border-red-600' : 'border-border'
                                      }`}
                                      value={pairing.player2Id ?? 'BYE'}
                                      onChange={(event) =>
                                        updateDraftPairing(
                                          pairing.draftId,
                                          'player2Id',
                                          event.target.value === 'BYE' ? null : event.target.value,
                                        )
                                      }
                                    >
                                      <option value="BYE">BYE</option>
                                      {leagueMembers.map((membership) => (
                                        <option key={membership.userId} value={membership.userId}>
                                          {primaryName(membership.user)}
                                        </option>
                                      ))}
                                    </select>
                                    {hasSamePlayerError ? (
                                      <p className="mt-1 text-xs text-red-600">Player 1 and Player 2 cannot be the same.</p>
                                    ) : null}
                                  </td>
                                  <td className="py-2">
                                    <button
                                      type="button"
                                      className="rounded-md border border-border px-2 py-1 text-xs text-destructive"
                                      disabled={isMutating}
                                      onClick={() => removeDraftPairing(pairing.draftId)}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs"
                        disabled={isMutating}
                        onClick={addDraftPairing}
                      >
                        + Add pairing
                      </button>

                      {draftPairingValidation.unpairedMembers.length > 0 ? (
                        <div className="rounded-md border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                          Not paired:{' '}
                          {draftPairingValidation.unpairedMembers
                            .map((memberId) => memberNameById.get(memberId) ?? memberId)
                            .join(', ')}
                        </div>
                      ) : null}
                    </div>
                  ) : round.matches.map((match) => {
                    const isParticipant = Boolean(user && (match.player1.id === user.id || match.player2?.id === user.id));
                    const canReport = (isParticipant || isAdmin) && match.status === 'pending' && round.status === 'in_progress';
                    const canConfirmOrDispute = isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
                    const canResolve = isAdmin && match.status === 'disputed';
                    const record = matchResultRecord(match);
                    const verdict = matchResultVerdict(match);

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
    </div>
  );
}
