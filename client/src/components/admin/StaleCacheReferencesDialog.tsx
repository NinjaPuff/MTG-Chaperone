import { useState } from 'react';

export type ResolveStaleAction =
  | { target: 'pool'; entryId: string; action: 'replace'; replacementScryfallId: string }
  | { target: 'pool'; entryId: string; action: 'remove' }
  | { target: 'decklist'; entryId: string; action: 'replace'; replacementScryfallId: string }
  | { target: 'decklist'; entryId: string; action: 'remove' };

export type StaleReference = {
  scryfallId: string;
  name: string;
  setCode: string;
  suggestedReplacement: { scryfallId: string; name: string; collectorNumber: string | null } | null;
  poolUsages: Array<{
    entryId: string;
    poolId: string;
    userId: string;
    displayName: string;
    quantity: number;
    phaseLabel: string;
  }>;
  decklistUsages: Array<{
    entryId: string;
    decklistId: string;
    userId: string;
    displayName: string;
    quantity: number;
    eventName: string;
    roundLabel: string;
  }>;
};

type StaleCacheReferencesDialogProps = {
  deletedCards: Array<{ scryfallId: string; name: string; setCode: string }>;
  staleReferences: StaleReference[];
  resolving: boolean;
  onResolve: (actions: ResolveStaleAction[]) => void;
  onDismiss: () => void;
};

function buildActionsForCard(
  reference: StaleReference,
  action: 'replace' | 'remove',
): ResolveStaleAction[] {
  const actions: ResolveStaleAction[] = [];

  for (const usage of reference.poolUsages) {
    if (action === 'replace' && reference.suggestedReplacement) {
      actions.push({
        target: 'pool',
        entryId: usage.entryId,
        action: 'replace',
        replacementScryfallId: reference.suggestedReplacement.scryfallId,
      });
    } else {
      actions.push({ target: 'pool', entryId: usage.entryId, action: 'remove' });
    }
  }

  for (const usage of reference.decklistUsages) {
    if (action === 'replace' && reference.suggestedReplacement) {
      actions.push({
        target: 'decklist',
        entryId: usage.entryId,
        action: 'replace',
        replacementScryfallId: reference.suggestedReplacement.scryfallId,
      });
    } else {
      actions.push({ target: 'decklist', entryId: usage.entryId, action: 'remove' });
    }
  }

  return actions;
}

function usageSummary(reference: StaleReference) {
  const parts: string[] = [];
  if (reference.poolUsages.length > 0) {
    const total = reference.poolUsages.reduce((sum, u) => sum + u.quantity, 0);
    parts.push(`${reference.poolUsages.length} pool${reference.poolUsages.length !== 1 ? 's' : ''} (${total}x)`);
  }
  if (reference.decklistUsages.length > 0) {
    const total = reference.decklistUsages.reduce((sum, u) => sum + u.quantity, 0);
    parts.push(`${reference.decklistUsages.length} deck${reference.decklistUsages.length !== 1 ? 's' : ''} (${total}x)`);
  }
  return parts.join(', ');
}

export function StaleCacheReferencesDialog({
  deletedCards,
  staleReferences,
  resolving,
  onResolve,
  onDismiss,
}: StaleCacheReferencesDialogProps) {
  const [removedExpanded, setRemovedExpanded] = useState(false);

  const replaceAllActions: ResolveStaleAction[] = [];
  for (const reference of staleReferences) {
    if (!reference.suggestedReplacement) {
      continue;
    }
    replaceAllActions.push(...buildActionsForCard(reference, 'replace'));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close stale references dialog"
        className="absolute inset-0 bg-black/70"
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resolve stale card references"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Resolve stale card references</h2>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onDismiss}
            disabled={resolving}
          >
            Dismiss
          </button>
        </div>

        {staleReferences.length > 0 ? (
          <div className="mb-4">
            <h3 className="mb-2 font-medium">Cards needing attention</h3>
            <div className="space-y-2">
              {staleReferences.map((reference) => (
                <div
                  key={reference.scryfallId}
                  data-testid={`stale-card-${reference.scryfallId}`}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{reference.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {reference.setCode} &middot; {usageSummary(reference)}
                      </p>
                      {reference.suggestedReplacement ? (
                        <p className="mt-1 text-xs text-emerald-600">
                          Replace with: {reference.suggestedReplacement.name}
                          {reference.suggestedReplacement.collectorNumber
                            ? ` (#${reference.suggestedReplacement.collectorNumber})`
                            : ''}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-600">No replacement found</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        aria-label={`Replace ${reference.name}`}
                        className="rounded-md border border-border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!reference.suggestedReplacement || resolving}
                        onClick={() => onResolve(buildActionsForCard(reference, 'replace'))}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${reference.name}`}
                        className="rounded-md border border-border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={resolving}
                        onClick={() => onResolve(buildActionsForCard(reference, 'remove'))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {replaceAllActions.length > 0 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onResolve(replaceAllActions)}
                  disabled={resolving}
                >
                  Replace all with suggestions
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {deletedCards.length > 0 ? (
          <div className="rounded-md border border-border p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setRemovedExpanded((prev) => !prev)}
            >
              <h3 className="font-medium">
                Removed from cache ({deletedCards.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                {removedExpanded ? '▲ Collapse' : '▼ Expand'}
              </span>
            </button>
            {removedExpanded ? (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {deletedCards.map((card) => (
                  <li key={card.scryfallId}>
                    {card.name} ({card.setCode})
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
