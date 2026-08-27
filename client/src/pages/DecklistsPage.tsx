import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DeckAnalyticsView } from '@/components/deckbuilder/DeckAnalyticsView';
import { DeckCardList } from '@/components/deckbuilder/DeckCardList';
import { ShareDeckDialog } from '@/components/deckbuilder/ShareDeckDialog';
import { ExportDeckDialog } from '@/components/deckbuilder/ExportDeckDialog';
import { ApiError, apiRequest } from '@/lib/api';
import { seasonDecklistToBuilderDeck, toDeckSharePayload, type SeasonArchiveCachedCard } from '@/lib/archiveDeck';
import { mintDeckShareUrl } from '@/lib/shareLink';
import { useAuth } from '@/context/AuthContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { primaryName } from '@/lib/userDisplay';

type ApiListResponse<T> = { data: T[]; meta?: { decklistVisibility?: boolean } };

type SeasonEvent = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  orderIndex: number;
};

type SeasonDecklist = {
  id: string;
  orderIndex: number;
  name: string | null;
  status: 'draft' | 'submitted' | 'locked';
  user?: {
    id: string;
    displayName: string;
    publicName?: string | null;
    slug: string;
  };
  event: {
    id: string;
    name: string;
    status: 'setup' | 'active' | 'completed';
    orderIndex: number;
  };
  round: {
    id: string;
    roundNumber: number;
    status: 'not_started' | 'in_progress' | 'completed';
  };
  entries: Array<{
    id: string;
    quantity: number;
    zone: 'main' | 'sideboard';
    cachedCard: SeasonArchiveCachedCard;
  }>;
};

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

function buildEventGroups(decks: SeasonDecklist[]): EventGroup[] {
  const byEvent = new Map<string, SeasonDecklist[]>();
  for (const deck of decks) {
    const list = byEvent.get(deck.event.id) ?? [];
    list.push(deck);
    byEvent.set(deck.event.id, list);
  }

  return [...byEvent.entries()]
    .map(([eventId, eventDecks]) => {
      const first = eventDecks[0];
      const byRound = new Map<string, SeasonDecklist[]>();
      for (const deck of eventDecks) {
        const list = byRound.get(deck.round.id) ?? [];
        list.push(deck);
        byRound.set(deck.round.id, list);
      }

      const rounds = [...byRound.entries()]
        .map(([roundId, roundDecks]) => {
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
            roundId,
            roundNumber: roundDecks[0]?.round.roundNumber ?? 0,
            players,
          };
        })
        .sort((a, b) => a.roundNumber - b.roundNumber);

      return {
        eventId,
        eventName: first?.event.name ?? eventId,
        orderIndex: first?.event.orderIndex ?? 0,
        rounds,
      };
    })
    .sort((a, b) => b.orderIndex - a.orderIndex);
}

function ArchiveDeckRow({
  decklist,
  playerName,
  canShare,
  ownerDisplayName,
}: {
  decklist: SeasonDecklist;
  playerName: string;
  canShare: boolean;
  ownerDisplayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'details'>('list');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const registered = isRegisteredStatus(decklist.status);
  const builderDeck = seasonDecklistToBuilderDeck(decklist);
  const mainCards = builderDeck.cards.filter((card) => card.zone === 'main');
  const sideboardCards = builderDeck.cards.filter((card) => card.zone === 'sideboard');

  const openShare = async () => {
    if (shareBusy) {
      return;
    }
    setShareBusy(true);
    setShareError(null);
    try {
      setShareUrl(
        await mintDeckShareUrl(
          decklist.id,
          toDeckSharePayload({
            ownerDisplayName,
            deckName: decklist.name ?? `Deck ${decklist.orderIndex + 1}`,
            eventName: decklist.event.name,
            roundNumber: decklist.round.roundNumber,
            status: decklist.status,
            cards: builderDeck.cards,
          }),
        ),
      );
    } catch {
      setShareUrl(null);
      setShareError('Failed to create share link');
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <>
    <details
      className="rounded-md border border-border/70 bg-card p-3"
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        setOpen(nextOpen);
        if (!nextOpen) {
          setView('list');
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-medium">
        {playerName ? `${playerName} — ` : ''}
        {decklist.name ?? `Deck ${decklist.orderIndex + 1}`}{' '}
        <span className="text-xs font-semibold">{registered ? 'Registered' : 'Unregistered'}</span>{' '}
        <span className="text-xs text-muted-foreground">(read-only)</span>
      </summary>
      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">View</span>
            <div className="inline-flex rounded-md bg-muted p-0.5" role="group" aria-label="Deck view">
              <button
                type="button"
                aria-pressed={view === 'list'}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  view === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setView('list')}
              >
                List
              </button>
              <button
                type="button"
                aria-pressed={view === 'details'}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  view === 'details'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setView('details')}
              >
                Details
              </button>
            </div>
            {canShare ? (
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={builderDeck.cards.length === 0}
                  title={builderDeck.cards.length === 0 ? 'Nothing to export.' : undefined}
                  onClick={() => setShowExportDialog(true)}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={shareBusy}
                  onClick={() => void openShare()}
                >
                  Share
                </button>
              </div>
            ) : null}
          </div>
          {shareError ? <p className="text-sm text-destructive">{shareError}</p> : null}
          {view === 'details' ? (
            <DeckAnalyticsView deck={builderDeck} editable={false} showBuilderChrome={false} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <DeckCardList title="Main Deck" emptyText="No cards" cards={mainCards} />
              <DeckCardList title="Sideboard" emptyText="No cards" cards={sideboardCards} />
            </div>
          )}
        </div>
      ) : null}
    </details>
    {shareUrl ? <ShareDeckDialog url={shareUrl} onClose={() => setShareUrl(null)} /> : null}
    {showExportDialog ? (
      <ExportDeckDialog
        deckName={decklist.name ?? `Deck ${decklist.orderIndex + 1}`}
        cards={builderDeck.cards}
        onClose={() => setShowExportDialog(false)}
      />
    ) : null}
    </>
  );
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
                        key={decklist.id}
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

  const myGroups = useMemo(() => buildEventGroups(myArchiveDecks), [myArchiveDecks]);
  const leagueGroups = useMemo(() => buildEventGroups(leagueArchiveDecks), [leagueArchiveDecks]);

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
