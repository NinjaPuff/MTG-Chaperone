import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaleCacheReferencesDialog } from '@/components/admin/StaleCacheReferencesDialog';

const staleReferences = [
  {
    scryfallId: 'digital-1',
    name: 'A-Some Card',
    setCode: 'SNC',
    suggestedReplacement: {
      scryfallId: 'paper-1',
      name: 'Some Card',
      collectorNumber: '1',
    },
    poolUsages: [
      {
        entryId: 'pool-entry-1',
        poolId: 'pool-1',
        userId: 'user-1',
        displayName: 'Alice',
        quantity: 2,
        phaseLabel: 'Initial Pool',
      },
    ],
    decklistUsages: [
      {
        entryId: 'deck-entry-1',
        decklistId: 'deck-1',
        userId: 'user-2',
        displayName: 'Bob',
        quantity: 1,
        eventName: 'Event One',
        roundLabel: 'Round 1',
      },
    ],
  },
  {
    scryfallId: 'digital-2',
    name: 'No Suggestion Card',
    setCode: 'DMU',
    suggestedReplacement: null,
    poolUsages: [
      {
        entryId: 'pool-entry-2',
        poolId: 'pool-1',
        userId: 'user-1',
        displayName: 'Alice',
        quantity: 1,
        phaseLabel: 'Initial Pool',
      },
    ],
    decklistUsages: [],
  },
];

describe('StaleCacheReferencesDialog', () => {
  it('shows stale cards before deleted cards section', () => {
    const { container } = render(
      <StaleCacheReferencesDialog
        deletedCards={[{ scryfallId: 'digital-1', name: 'A-Some Card', setCode: 'SNC' }]}
        staleReferences={staleReferences}
        resolving={false}
        onResolve={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Resolve stale card references' })).toBeInTheDocument();

    const headings = container.querySelectorAll('h3');
    const headingTexts = [...headings].map((h) => h.textContent);
    const cardsIdx = headingTexts.findIndex((t) => t?.includes('Cards needing attention'));
    const removedIdx = headingTexts.findIndex((t) => t?.includes('Removed from cache'));
    expect(cardsIdx).toBeGreaterThanOrEqual(0);
    expect(removedIdx).toBeGreaterThanOrEqual(0);
    expect(cardsIdx).toBeLessThan(removedIdx);
  });

  it('shows card name as primary entity with usage summary', () => {
    render(
      <StaleCacheReferencesDialog
        deletedCards={[]}
        staleReferences={staleReferences}
        resolving={false}
        onResolve={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('A-Some Card')).toBeInTheDocument();
    expect(screen.getByText(/1 pool.*1 deck/i)).toBeInTheDocument();
  });

  it('per-card replace sends actions for all pool and deck entries of that card', () => {
    const onResolve = vi.fn();

    render(
      <StaleCacheReferencesDialog
        deletedCards={[]}
        staleReferences={staleReferences}
        resolving={false}
        onResolve={onResolve}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Replace.*A-Some Card/i }));

    expect(onResolve).toHaveBeenCalledWith([
      {
        target: 'pool',
        entryId: 'pool-entry-1',
        action: 'replace',
        replacementScryfallId: 'paper-1',
      },
      {
        target: 'decklist',
        entryId: 'deck-entry-1',
        action: 'replace',
        replacementScryfallId: 'paper-1',
      },
    ]);
  });

  it('per-card remove sends remove actions for all pool and deck entries of that card', () => {
    const onResolve = vi.fn();

    render(
      <StaleCacheReferencesDialog
        deletedCards={[]}
        staleReferences={staleReferences}
        resolving={false}
        onResolve={onResolve}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Remove.*No Suggestion Card/i }));

    expect(onResolve).toHaveBeenCalledWith([
      { target: 'pool', entryId: 'pool-entry-2', action: 'remove' },
    ]);
  });

  it('disables per-card replace when there is no suggested replacement', () => {
    render(
      <StaleCacheReferencesDialog
        deletedCards={[]}
        staleReferences={staleReferences}
        resolving={false}
        onResolve={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const noSuggestionSection = screen.getByText('No Suggestion Card').closest('[data-testid]')!;
    const replaceBtn = within(noSuggestionSection).queryByRole('button', { name: /Replace/i });
    expect(replaceBtn).toBeDisabled();
  });

  it('replace-all batches only resolvable stale entries across all cards', () => {
    const onResolve = vi.fn();

    render(
      <StaleCacheReferencesDialog
        deletedCards={[]}
        staleReferences={staleReferences}
        resolving={false}
        onResolve={onResolve}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replace all with suggestions' }));

    expect(onResolve).toHaveBeenCalledWith([
      {
        target: 'pool',
        entryId: 'pool-entry-1',
        action: 'replace',
        replacementScryfallId: 'paper-1',
      },
      {
        target: 'decklist',
        entryId: 'deck-entry-1',
        action: 'replace',
        replacementScryfallId: 'paper-1',
      },
    ]);
  });

  it('removed-from-cache section is collapsed by default and expands on click', () => {
    const deletedCards = [
      { scryfallId: 'del-1', name: 'Deleted Card A', setCode: 'SNC' },
      { scryfallId: 'del-2', name: 'Deleted Card B', setCode: 'SNC' },
    ];

    render(
      <StaleCacheReferencesDialog
        deletedCards={deletedCards}
        staleReferences={[]}
        resolving={false}
        onResolve={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/Removed from cache \(2\)/)).toBeInTheDocument();
    expect(screen.queryByText('Deleted Card A (SNC)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Removed from cache \(2\)/));

    expect(screen.getByText('Deleted Card A (SNC)')).toBeInTheDocument();
    expect(screen.getByText('Deleted Card B (SNC)')).toBeInTheDocument();
  });
});
