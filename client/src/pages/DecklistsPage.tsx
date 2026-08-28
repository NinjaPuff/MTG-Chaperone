import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArchiveDeckRow, type ArchiveDecklist } from '@/components/deckbuilder/ArchiveDeckRow';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { primaryName } from '@/lib/userDisplay';

type ApiListResponse<T> = { data: T[]; meta?: { decklistVisibility?: boolean } };

type SeasonEvent = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  orderIndex: number;
  config?: { deckCount?: number | null } | null;
  rounds?: Array<{
    id: string;
    roundNumber: number;
    status: 'not_started' | 'in_progress' | 'completed';
  }>;
};

type SeasonDecklist = ArchiveDecklist;

type PlayerRoundGroup = {
  playerKey: string;
  playerName: string;
  decks: SeasonDecklist[];
};

type RoundGroup = {
  roundId: string;
  roundNumber: number;
  players: PlayerRoundGroup[];
};

type EventGroup = {
  eventId: string;
  eventName: string;
  orderIndex: number;
  rounds: RoundGroup[];
};

function isArchiveRound(
  event: { status: 'setup' | 'active' | 'completed' },
  round: { status: 'not_started' | 'in_progress' | 'completed' },
) {
  return event.status === 'completed' || round.status === 'completed';
}

function isRegisteredStatus(status: SeasonDecklist['status']) {
  return status === 'submitted' || status === 'locked';
}

function isOfficialRequired(deck: SeasonDecklist, deckCount: number) {
  return isRegisteredStatus(deck.status) && deck.orderIndex < deckCount;
}

function completedRoundsForEvent(eventMeta: SeasonEvent | undefined, eventDecks: SeasonDecklist[]) {
  const fromPayload = (eventMeta?.rounds ?? []).filter((round) => round.status === 'completed');
  if (fromPayload.length > 0) {
    return [...fromPayload].sort((left, right) => left.roundNumber - right.roundNumber);
  }
  const byId = new Map<string, SeasonDecklist['round']>();
  for (const deck of eventDecks) {
    if (deck.round.status === 'completed') {
      byId.set(deck.round.id, deck.round);
    }
  }
  return [...byId.values()].sort((left, right) => left.roundNumber - right.roundNumber);
}

function buildEventGroups(decks: SeasonDecklist[], events: SeasonEvent[]): EventGroup[] {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const byEvent = new Map<string, SeasonDecklist[]>();
  for (const deck of decks) {
    const list = byEvent.get(deck.event.id) ?? [];
    list.push(deck);
    byEvent.set(deck.event.id, list);
  }

  return [...byEvent.entries()]
    .map(([eventId, eventDecks]) => {
      const first = eventDecks[0];
      const eventMeta = eventsById.get(eventId);
      const deckCount = Math.max(1, eventMeta?.config?.deckCount ?? 1);
      const completedRounds = completedRoundsForEvent(eventMeta, eventDecks);

      const rounds = completedRounds
        .map((round) => {
          const roundDecks: SeasonDecklist[] = [];
          for (const deck of eventDecks) {
            if (isOfficialRequired(deck, deckCount)) {
              roundDecks.push({
                ...deck,
                round: {
                  id: round.id,
                  roundNumber: round.roundNumber,
                  status: round.status,
                },
              });
              continue;
            }
            if (deck.round.id === round.id) {
              roundDecks.push(deck);
            }
          }

          const byPlayer = new Map<string, SeasonDecklist[]>();
          for (const deck of roundDecks) {
            const key = deck.user?.id ?? deck.id;
            const list = byPlayer.get(key) ?? [];
            list.push(deck);
            byPlayer.set(key, list);
          }

          const players = [...byPlayer.entries()]
            .map(([playerKey, playerDecks]) => ({
              playerKey,
              playerName: playerDecks[0]?.user ? primaryName(playerDecks[0].user) : '',
              decks: [...playerDecks].sort((a, b) => {
                const registeredDelta = Number(isRegisteredStatus(b.status)) - Number(isRegisteredStatus(a.status));
                if (registeredDelta !== 0) {
                  return registeredDelta;
                }
                return a.orderIndex - b.orderIndex;
              }),
            }))
            .sort((a, b) => a.playerName.localeCompare(b.playerName));

          return {
            roundId: round.id,
            roundNumber: round.roundNumber,
            players,
          };
        })
        .filter((roundGroup) => roundGroup.players.length > 0);

      return {
        eventId,
        eventName: first?.event.name ?? eventId,
        orderIndex: first?.event.orderIndex ?? 0,
        rounds,
      };
    })
    .sort((a, b) => b.orderIndex - a.orderIndex);
}

function DeckArchiveList({
  groups,
  viewerUserId,
}: {
  groups: EventGroup[];
  viewerUserId?: string;
}) {
  return (
    <div className="mt-3 space-y-3">
      {groups.map((group) => (
        <div key={group.eventId} className="rounded-lg border border-border/70 bg-background/50 p-3">
          <h3 className="text-sm font-semibold">{group.eventName}</h3>
          <div className="mt-3 space-y-4">
            {group.rounds.map((round) => (
              <div key={round.roundId} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Round {round.roundNumber}
                </h4>
                {round.players.map((player) => (
                  <div key={player.playerKey} className="space-y-2">
                    {player.decks.map((decklist) => (
                      <ArchiveDeckRow
                        key={`${round.roundId}-${decklist.id}`}
                        decklist={decklist}
                        playerName={player.playerName}
                        canShare={Boolean(viewerUserId)}
                        ownerDisplayName={decklist.user ? primaryName(decklist.user) : player.playerName}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DecklistsPage() {
  const { user } = useAuth();
  const { activeSeasonId, isLoading: loadingLeague } = useCurrentLeague();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const playerSlug = searchParams.get('player');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<SeasonEvent | null>(null);
  const [seasonEvents, setSeasonEvents] = useState<SeasonEvent[]>([]);
  const [seasonDecklists, setSeasonDecklists] = useState<SeasonDecklist[]>([]);
  const [decklistVisibility, setDecklistVisibility] = useState<boolean | null>(null);

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
        const eventsResponse = await apiRequest<ApiListResponse<SeasonEvent>>(
          `/api/seasons/${activeSeasonId}/events`,
        );

        const activeEvent =
          eventsResponse.data.find((event) => event.status === 'active') ??
          eventsResponse.data.find((event) => event.status === 'setup') ??
          null;
        setSeasonEvents(eventsResponse.data);
        setCurrentEvent(activeEvent);

        const seasonResponse = await apiRequest<ApiListResponse<SeasonDecklist>>(
          `/api/seasons/${activeSeasonId}/decklists`,
        );
        setSeasonDecklists(seasonResponse.data);
        setDecklistVisibility(seasonResponse.meta?.decklistVisibility ?? true);
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load deck context');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [activeSeasonId, loadingLeague]);

  const archiveDecks = useMemo(
    () => seasonDecklists.filter((decklist) => isArchiveRound(decklist.event, decklist.round)),
    [seasonDecklists],
  );

  const myArchiveDecks = useMemo(() => {
    if (!user || playerSlug) {
      return [];
    }
    return archiveDecks.filter((decklist) => decklist.user?.id === user.id);
  }, [archiveDecks, playerSlug, user]);

  const leagueArchiveDecks = useMemo(() => {
    if (playerSlug) {
      return archiveDecks.filter((decklist) => decklist.user?.slug === playerSlug);
    }
    if (!user) {
      return archiveDecks;
    }
    return archiveDecks.filter((decklist) => decklist.user?.id !== user.id);
  }, [archiveDecks, playerSlug, user]);

  const myGroups = useMemo(() => buildEventGroups(myArchiveDecks, seasonEvents), [myArchiveDecks, seasonEvents]);
  const leagueGroups = useMemo(
    () => buildEventGroups(leagueArchiveDecks, seasonEvents),
    [leagueArchiveDecks, seasonEvents],
  );

  const scopedPlayerName = useMemo(() => {
    if (!playerSlug) {
      return null;
    }
    const match = seasonDecklists.find((decklist) => decklist.user?.slug === playerSlug);
    return match?.user ? primaryName(match.user) : null;
  }, [playerSlug, seasonDecklists]);

  const archiveHeading = playerSlug
    ? scopedPlayerName
      ? `${scopedPlayerName}'s decklists`
      : "This player's decklists"
    : 'League decks';

  const pageSubtitle = playerSlug
    ? 'Browse previous-round decklists for this player.'
    : user
      ? 'View and build decklists from your card pool.'
      : 'Browse previous-round decklists for the current season.';

  const openCurrentDeckbuilder = () => {
    if (!currentEvent) {
      return;
    }
    navigate(`/events/${currentEvent.id}/build`);
  };

  const leagueEmptyCopy = (() => {
    if (playerSlug && leagueArchiveDecks.length === 0) {
      return 'No previous-round decks recorded for this player.';
    }
    if (!playerSlug && decklistVisibility === false && user?.role !== 'admin') {
      return user
        ? 'Decklists are hidden for this season.'
        : 'Decklists are hidden for this season. Sign in to view your own decklists.';
    }
    if (leagueGroups.length === 0) {
      return 'No previous decklists yet.';
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Decklists</h1>
        <p className="text-muted-foreground mt-1">{pageSubtitle}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {user && !playerSlug ? (
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
      ) : null}

      {user && !playerSlug ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Your previous decks</h2>
          {myGroups.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No previous decklists yet.</p>
          ) : (
            <DeckArchiveList groups={myGroups} viewerUserId={user.id} />
          )}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{archiveHeading}</h2>
        {leagueEmptyCopy ? <p className="mt-2 text-sm text-muted-foreground">{leagueEmptyCopy}</p> : null}
        {!leagueEmptyCopy ? <DeckArchiveList groups={leagueGroups} viewerUserId={user?.id} /> : null}

        <Link to="/schedule" className="mt-4 inline-block text-sm underline">
          Go to schedule
        </Link>
      </div>
    </div>
  );
}
