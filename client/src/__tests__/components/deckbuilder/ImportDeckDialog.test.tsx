import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  authApiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  authApiRequest: mocks.authApiRequest,
  ApiError: class ApiError extends Error {},
}));

import { ImportDeckDialog } from '@/components/deckbuilder/ImportDeckDialog';

describe('ImportDeckDialog', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
  });

  it('shows only completed decks and excludes current event', async () => {
    const onImport = vi.fn();
    mocks.authApiRequest.mockResolvedValue({
      data: [
        {
          id: 'deck-completed',
          orderIndex: 0,
          name: 'Completed Deck',
          event: { id: 'event-old', name: 'Old Event', status: 'completed', orderIndex: 1 },
          round: { id: 'r1', roundNumber: 1 },
          entries: [{ cachedCardId: 'card-1', quantity: 2, zone: 'main' }],
        },
        {
          id: 'deck-current',
          orderIndex: 0,
          name: 'Current Event Deck',
          event: { id: 'event-current', name: 'Current Event', status: 'completed', orderIndex: 2 },
          round: { id: 'r2', roundNumber: 1 },
          entries: [{ cachedCardId: 'card-2', quantity: 1, zone: 'main' }],
        },
        {
          id: 'deck-active',
          orderIndex: 0,
          name: 'Active Deck',
          event: { id: 'event-active', name: 'Active Event', status: 'active', orderIndex: 3 },
          round: { id: 'r3', roundNumber: 1 },
          entries: [{ cachedCardId: 'card-3', quantity: 1, zone: 'main' }],
        },
      ],
    });

    renderWithAppProviders(
      <ImportDeckDialog
        open
        seasonId="season-1"
        excludeEventId="event-current"
        getEntryIssueSummary={() => ({ invalidCardIds: [], summary: 'No issues' })}
        onClose={vi.fn()}
        onImport={onImport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Old Event')).toBeInTheDocument();
    });

    expect(screen.getByText(/Completed Deck - Round 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Current Event Deck/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Deck/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Completed Deck - Round 1/i }));
    expect(onImport).toHaveBeenCalledWith([{ cachedCardId: 'card-1', quantity: 2, zone: 'main' }]);
  });

  it('renders empty state when no decks are importable', async () => {
    mocks.authApiRequest.mockResolvedValue({ data: [] });
    renderWithAppProviders(
      <ImportDeckDialog
        open
        seasonId="season-1"
        excludeEventId="event-current"
        getEntryIssueSummary={() => ({ invalidCardIds: [], summary: 'No issues' })}
        onClose={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('No previous decks found for completed events.')).toBeInTheDocument();
    });
  });

  it('shows warning indicator when imported deck has unavailable cards', async () => {
    mocks.authApiRequest.mockResolvedValue({
      data: [
        {
          id: 'deck-warning',
          orderIndex: 0,
          name: 'Risky Deck',
          event: { id: 'event-old', name: 'Old Event', status: 'completed', orderIndex: 1 },
          round: { id: 'r1', roundNumber: 1 },
          entries: [
            { cachedCardId: 'card-available', quantity: 2, zone: 'main' },
            { cachedCardId: 'card-missing', quantity: 1, zone: 'sideboard' },
          ],
        },
      ],
    });

    renderWithAppProviders(
      <ImportDeckDialog
        open
        seasonId="season-1"
        excludeEventId="event-current"
        getEntryIssueSummary={() => ({
          invalidCardIds: ['card-missing'],
          summary: '1 card fails current round constraints (pool copies, restrictions, or unavailable cards).',
          details: ['- Lightning Bolt: 5 allocated across decks, 4 allowed.'],
        })}
        onClose={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Risky Deck - Round 1/)).toBeInTheDocument();
    });

    const warning = screen.getByLabelText('Import warning');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute(
      'title',
      expect.stringContaining('Lightning Bolt: 5 allocated across decks, 4 allowed.'),
    );
    expect(screen.getByText(/1 card violates current round constraints/)).toBeInTheDocument();
  });
});

