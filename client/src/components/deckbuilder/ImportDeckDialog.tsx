import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ApiError, authApiRequest } from '@/lib/api';

type ApiListResponse<T> = { data: T[] };

export type ImportEntry = {
  cachedCardId: string;
  quantity: number;
  zone: 'main' | 'sideboard';
};

type ImportDeck = {
  id: string;
  orderIndex: number;
  name: string | null;
  event: {
    id: string;
    name: string;
    status: 'setup' | 'active' | 'completed';
    orderIndex: number;
  };
  round: {
    id: string;
    roundNumber: number;
  };
  entries: Array<ImportEntry>;
};

type ImportDeckGroup = {
  eventId: string;
  eventName: string;
  orderIndex: number;
  decks: ImportDeck[];
};

type ImportDeckDialogProps = {
  open: boolean;
  seasonId: string | null;
  excludeEventId?: string;
  getEntryIssueSummary?: (entries: ImportEntry[]) => {
    invalidCardIds: string[];
    summary: string;
    details?: string[];
  };
  onClose: () => void;
  onImport: (entries: ImportEntry[]) => void;
};

export function ImportDeckDialog({
  open,
  seasonId,
  excludeEventId,
  getEntryIssueSummary,
  onClose,
  onImport,
}: ImportDeckDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decks, setDecks] = useState<ImportDeck[]>([]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setDecks([]);
      return;
    }
    if (!seasonId) {
      return;
    }

    let canceled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authApiRequest<ApiListResponse<ImportDeck>>(
          `/api/decklists/my-season/${seasonId}`,
        );
        if (canceled) {
          return;
        }
        const filtered = response.data.filter(
          (deck) => deck.event.status === 'completed' && deck.event.id !== excludeEventId,
        );
        setDecks(filtered);
      } catch (loadError) {
        if (canceled) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load previous decks');
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [open, seasonId, excludeEventId]);

  const groupedDecks = useMemo<ImportDeckGroup[]>(() => {
    const grouped = new Map<string, ImportDeckGroup>();
    for (const deck of decks) {
      const existing = grouped.get(deck.event.id);
      if (existing) {
        existing.decks.push(deck);
        continue;
      }
      grouped.set(deck.event.id, {
        eventId: deck.event.id,
        eventName: deck.event.name,
        orderIndex: deck.event.orderIndex,
        decks: [deck],
      });
    }
    const groups = [...grouped.values()].sort((a, b) => b.orderIndex - a.orderIndex);
    for (const group of groups) {
      group.decks.sort((a, b) => b.round.roundNumber - a.round.roundNumber || a.orderIndex - b.orderIndex);
    }
    return groups;
  }, [decks]);
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close import dialog"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import previous deck"
        className="relative w-full max-w-3xl space-y-4 rounded-lg border border-border bg-card p-4 shadow-lg md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Import Previous Deck</h2>
            <p className="text-sm text-muted-foreground">
              Choose a deck from a completed event to replace the active deck.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {!seasonId ? (
          <p className="text-sm text-muted-foreground">No active season available.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading previous decks...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : groupedDecks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No previous decks found for completed events.</p>
        ) : (
          <div className="max-h-[65dvh] space-y-3 overflow-y-auto pr-1">
            {groupedDecks.map((group) => (
              <div key={group.eventId} className="rounded-md border border-border/70 bg-background/50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{group.eventName}</h3>
                  <span className="text-xs text-muted-foreground">
                    {group.decks.length} {group.decks.length === 1 ? 'deck' : 'decks'}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.decks.map((deck) => {
                    const totalCards = deck.entries.reduce((sum, entry) => sum + entry.quantity, 0);
                    const issueSummary = getEntryIssueSummary?.(deck.entries);
                    const invalidCount = issueSummary?.invalidCardIds.length ?? 0;
                    const detailLines = issueSummary?.details ?? [];
                    const warningTooltip =
                      detailLines.length > 0
                        ? `${issueSummary?.summary}\n${detailLines.join('\n')}`
                        : issueSummary?.summary;
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        className="block w-full rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted"
                        onClick={() => onImport(deck.entries)}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {deck.name ?? `Deck ${deck.orderIndex + 1}`} - Round {deck.round.roundNumber}
                          </p>
                          {invalidCount > 0 ? (
                            <span
                              className="inline-flex items-center text-amber-500"
                              title={warningTooltip}
                              aria-label="Import warning"
                            >
                              <AlertTriangle size={14} aria-hidden="true" />
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {totalCards} total cards ({deck.entries.length} unique cards)
                        </p>
                        {invalidCount > 0 ? (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            {invalidCount} card
                            {invalidCount === 1 ? ' violates' : 's violate'} current round constraints
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

