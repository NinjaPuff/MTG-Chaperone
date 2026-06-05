import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  authApiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  authApiRequest: mocks.authApiRequest,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'user' },
  }),
}));

vi.mock('@/hooks/useCardImageWidth', () => ({
  useCardImageWidth: () => ({
    cardImageWidth: 160,
    setCardImageWidth: vi.fn(),
  }),
}));

import { DeckBuilderPage } from '@/pages/DeckBuilderPage';

function renderPage() {
  renderWithAppProviders(
    <MemoryRouter initialEntries={['/events/e1/build']}>
      <Routes>
        <Route path="/events/:eventId/build" element={<DeckBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function poolCardEntry(quantity = 2) {
  return {
    quantity,
    cachedCard: {
      scryfallId: 'card-1',
      name: 'Lightning Bolt',
      layout: null,
      manaCost: '{R}',
      typeLine: 'Instant',
      rarity: 'common',
      setCode: 'LEA',
      colorIdentity: ['R'],
      imageUris: null,
      cmc: 1,
      colors: ['R'],
    },
  };
}

function configureApi(options?: {
  deckEntries?: Array<{
    cachedCardId: string;
    quantity: number;
    zone: 'main' | 'sideboard';
    cachedCard: {
      name: string;
      layout: string | null;
      manaCost: string | null;
      typeLine: string;
      cmc: number;
      colorIdentity: string[];
    };
  }>;
  poolQuantity?: number;
}) {
  const deckEntries = options?.deckEntries ?? [];
  const poolQuantity = options?.poolQuantity ?? 2;

  mocks.authApiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/events/e1/my-decklists') {
      return {
        data: {
          roundId: 'r1',
          roundNumber: 1,
          poolId: 'pool-1',
          decklists: [
            {
              id: 'deck-1',
              orderIndex: 0,
              name: 'Deck 1',
              status: 'draft',
              entries: deckEntries,
            },
          ],
          eventConfig: {
            deckCount: 1,
            minDeckSize: 40,
            sideboardRule: 'entire_pool',
            deckLockingMode: 'free_modification',
          },
          restrictedCards: [],
          basicLands: [
            {
              cachedCardId: 'plains-id',
              name: 'Plains',
              manaCost: null,
              typeLine: 'Basic Land — Plains',
              colorIdentity: ['W'],
            },
          ],
        },
      };
    }
    if (path === '/api/card-pools/pool-1') {
      return {
        data: {
          acquisitions: [
            {
              phaseLabel: 'P1',
              entries: [poolCardEntry(poolQuantity)],
            },
          ],
        },
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('DeckBuilderPage context menu', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
  });

  it('should_show_pool_context_menu_on_right_click', async () => {
    configureApi();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByText('Lightning Bolt'));
    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeInTheDocument();
  });

  it('should_add_to_sideboard_when_pool_menu_action_clicked', async () => {
    configureApi();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByText('Lightning Bolt'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to sideboard' }));

    expect(screen.getByRole('button', { name: /Sideboard/i })).toHaveTextContent('1');
  });

  it('should_disable_add_actions_when_pool_card_fully_allocated', async () => {
    configureApi({
      poolQuantity: 1,
      deckEntries: [
        {
          cachedCardId: 'card-1',
          quantity: 1,
          zone: 'main',
          cachedCard: {
            name: 'Lightning Bolt',
            layout: null,
            manaCost: '{R}',
            typeLine: 'Instant',
            cmc: 1,
            colorIdentity: ['R'],
          },
        },
      ],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0);
    });

    fireEvent.contextMenu(screen.getAllByText('Lightning Bolt')[0]);
    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeDisabled();
  });

  it('should_move_main_deck_card_to_sideboard_via_deck_row_menu', async () => {
    configureApi({
      deckEntries: [
        {
          cachedCardId: 'card-1',
          quantity: 1,
          zone: 'main',
          cachedCard: {
            name: 'Lightning Bolt',
            layout: null,
            manaCost: '{R}',
            typeLine: 'Instant',
            cmc: 1,
            colorIdentity: ['R'],
          },
        },
      ],
      poolQuantity: 2,
    });
    renderPage();

    await waitFor(() => {
      expect(within(screen.getByTestId('deck-sidebar-main-scroll')).getByRole('button', { name: /1x Lightning Bolt/i })).toBeInTheDocument();
    });

    const mainScroll = screen.getByTestId('deck-sidebar-main-scroll');
    fireEvent.contextMenu(within(mainScroll).getByRole('button', { name: /1x Lightning Bolt/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to sideboard' }));

    expect(screen.getByText('0/40')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sideboard/i }));
    const sideboardScroll = screen.getByTestId('deck-sidebar-sideboard-scroll');
    expect(within(sideboardScroll).getByRole('button', { name: /1x Lightning Bolt/i })).toBeInTheDocument();
    expect(within(mainScroll).queryByRole('button', { name: /Lightning Bolt/i })).not.toBeInTheDocument();
  });
});
