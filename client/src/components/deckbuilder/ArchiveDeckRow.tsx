import { useState } from 'react';
import { DeckAnalyticsView } from '@/components/deckbuilder/DeckAnalyticsView';
import { DeckCardList } from '@/components/deckbuilder/DeckCardList';
import { ExportDeckDialog } from '@/components/deckbuilder/ExportDeckDialog';
import { ShareDeckDialog } from '@/components/deckbuilder/ShareDeckDialog';
import {
  seasonDecklistToBuilderDeck,
  toDeckSharePayload,
  type SeasonArchiveCachedCard,
} from '@/lib/archiveDeck';
import { mintDeckShareUrl } from '@/lib/shareLink';

export type ArchiveDecklist = {
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

function isRegisteredStatus(status: ArchiveDecklist['status']) {
  return status === 'submitted' || status === 'locked';
}

export function ArchiveDeckRow({
  decklist,
  playerName,
  canShare,
  ownerDisplayName,
  showShareActions = true,
}: {
  decklist: ArchiveDecklist;
  playerName: string;
  canShare: boolean;
  ownerDisplayName: string;
  showShareActions?: boolean;
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
              {showShareActions && canShare ? (
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
