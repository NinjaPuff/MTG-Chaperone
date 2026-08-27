import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { DeckAnalyticsView } from '@/components/deckbuilder/DeckAnalyticsView';
import { DeckCardList } from '@/components/deckbuilder/DeckCardList';
import { ExportDeckDialog } from '@/components/deckbuilder/ExportDeckDialog';
import { snapshotToBuilderDeck, hydrateDeckSharePayload } from '@/lib/archiveDeck';
import { apiRequest } from '@/lib/api';
import { decodeDeckSharePayload, type DeckSharePayload } from '@mtg-league/shared';

function readMeta(name: string) {
  return document.querySelector(`meta[name="${name}"]`);
}

function upsertMeta(name: string, content: string) {
  let element = readMeta(name);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function useShareDiscovery(title: string | null) {
  useEffect(() => {
    if (!title) {
      return;
    }
    const previousTitle = document.title;
    const previousRobots = readMeta('robots')?.getAttribute('content') ?? null;
    const previousReferrer = readMeta('referrer')?.getAttribute('content') ?? null;
    const hadRobots = Boolean(readMeta('robots'));
    const hadReferrer = Boolean(readMeta('referrer'));

    document.title = title;
    upsertMeta('robots', 'noindex, nofollow');
    upsertMeta('referrer', 'no-referrer');

    return () => {
      document.title = previousTitle;
      const robots = readMeta('robots');
      const referrer = readMeta('referrer');
      if (hadRobots && robots) {
        robots.setAttribute('content', previousRobots ?? '');
      } else {
        robots?.remove();
      }
      if (hadReferrer && referrer) {
        referrer.setAttribute('content', previousReferrer ?? '');
      } else {
        referrer?.remove();
      }
    };
  }, [title]);
}

function InvalidShareLink() {
  useShareDiscovery('Invalid share link');
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <p className="mb-6 mt-2 text-xl text-muted-foreground">This share link is invalid.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export function ShareDeckPage() {
  const { token } = useParams<{ token?: string }>();
  const location = useLocation();
  const [view, setView] = useState<'list' | 'details'>('list');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [remote, setRemote] = useState<DeckSharePayload | null | 'loading'>(token ? 'loading' : null);
  const [hydrated, setHydrated] = useState<DeckSharePayload | null>(null);

  const hashSnapshot = useMemo(() => {
    if (token) {
      return null;
    }
    const encoded = location.hash.replace(/^#/, '');
    if (!encoded) {
      return null;
    }
    try {
      return decodeDeckSharePayload(encoded);
    } catch {
      return null;
    }
  }, [location.hash, token]);

  useEffect(() => {
    if (!token) {
      setRemote(null);
      return;
    }
    let cancelled = false;
    setRemote('loading');
    void apiRequest<{ data: DeckSharePayload }>(`/api/share/decklists/${encodeURIComponent(token)}`)
      .then((response) => {
        if (!cancelled) {
          setRemote(response.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemote(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const snapshot = token ? (remote === 'loading' ? null : remote) : hashSnapshot;
  const waitingForToken = Boolean(token) && remote === 'loading';

  useEffect(() => {
    if (!snapshot) {
      setHydrated(null);
      return;
    }
    let cancelled = false;
    setHydrated(snapshot);
    void hydrateDeckSharePayload(snapshot, async (scryfallId) => {
      const response = await apiRequest<{ data: {
        name?: string | null;
        layout?: string | null;
        manaCost?: string | null;
        typeLine?: string | null;
        cmc?: number | null;
        colorIdentity?: string[] | null;
        setCode?: string | null;
        collectorNumber?: string | null;
      } }>(`/api/cards/${scryfallId}`);
      return response.data;
    }).then((next) => {
      if (!cancelled) {
        setHydrated(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  useShareDiscovery(snapshot ? `${snapshot.deckName} — unlisted snapshot` : null);

  if (waitingForToken) {
    return <div className="text-sm text-muted-foreground">Loading snapshot…</div>;
  }

  if (!snapshot) {
    return <InvalidShareLink />;
  }

  const builderDeck = snapshotToBuilderDeck(hydrated ?? snapshot);
  const mainCards = builderDeck.cards.filter((card) => card.zone === 'main');
  const sideboardCards = builderDeck.cards.filter((card) => card.zone === 'sideboard');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Unlisted snapshot
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{snapshot.deckName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {snapshot.ownerDisplayName}
          {snapshot.eventName ? ` · ${snapshot.eventName}` : ''}
          {snapshot.roundNumber ? ` · Round ${snapshot.roundNumber}` : ''}
        </p>
      </div>
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
        {builderDeck.cards.length > 0 ? (
          <button
            type="button"
            className="ml-auto rounded border border-border bg-background px-2 py-0.5 text-xs font-medium hover:bg-muted"
            onClick={() => setShowExportDialog(true)}
          >
            Export
          </button>
        ) : null}
      </div>
      {view === 'details' ? (
        <DeckAnalyticsView deck={builderDeck} editable={false} showBuilderChrome={false} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <DeckCardList title="Main Deck" emptyText="No cards" cards={mainCards} />
          <DeckCardList title="Sideboard" emptyText="No cards" cards={sideboardCards} />
        </div>
      )}
      {showExportDialog ? (
        <ExportDeckDialog
          deckName={snapshot.deckName}
          cards={builderDeck.cards}
          onClose={() => setShowExportDialog(false)}
        />
      ) : null}
    </div>
  );
}
