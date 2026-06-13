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

vi.mock('@/hooks/useCurrentLeague', () => ({
  useCurrentLeague: () => ({
    activeSeasonId: 'season-1',
  }),
}));

import { DeckBuilderPage } from '@/pages/DeckBuilderPage';

type DeckStatus = 'draft' | 'submitted' | 'locked';

function renderPage() {
  renderWithAppProviders(
    <MemoryRouter initialEntries={['/events/e1/build']}>
      <Routes>
        <Route path="/events/:eventId/build" element={<DeckBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeDeckEntry(quantity: number) {
  return {
    cachedCardId: 'card-1',
    quantity,
    zone: 'main' as const,
    cachedCard: {
      name: 'Lightning Bolt',
      layout: null,
      manaCost: '{R}',
      typeLine: 'Instant',
      cmc: 1,
      colorIdentity: ['R'],
    },
  };
}

function configureApi(options: {
  poolQuantity: number;
  decks: Array<{ id: string; status: DeckStatus; entries: ReturnType<typeof makeDeckEntry>[]; orderIndex: number }>;
}) {
  mocks.authApiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/events/e1/my-decklists') {
      return {
        data: {
          roundId: 'r1',
          roundNumber: 1,
          poolId: 'pool-1',
          decklists: options.decks.map((deck) => ({
            id: deck.id,
            orderIndex: deck.orderIndex,
            name: `Deck ${deck.orderIndex + 1}`,
            status: deck.status,
            entries: deck.entries,
          })),
          registeredCount: options.decks.filter((deck) => deck.status !== 'draft').length,
          eventConfig: {
            format: 'swiss',
            deckCount: 2,
            minDeckSize: 40,
            sideboardRule: 'entire_pool',
            deckLockingMode: 'free_modification',
          },
          restrictedCards: [],
          basicLands: [],
        },
      };
    }
    if (path === '/api/card-pools/pool-1') {
      return {
        data: {
          acquisitions: [
            {
              phaseLabel: 'P1',
              entries: [
                {
                  quantity: options.poolQuantity,
                  cachedCard: {
                    scryfallId: 'card-1',
                    name: 'Lightning Bolt',
                    layout: null,
                    manaCost: '{R}',
                    typeLine: 'Instant',
                    rarity: 'common',
                    setCode: 'LEA',
                    imageUris: null,
                    cmc: 1,
                    colors: ['R'],
                    colorIdentity: ['R'],
                  },
                },
              ],
            },
          ],
        },
      };
    }

    if (path.startsWith('/api/decklists/')) {
      return {
        data: { isValid: true, errors: [], warnings: [], invalidCardIds: [] },
      };
    }

    throw new Error(`Unexpected path: ${path}`);
  });
}

function openPoolContextMenu() {
  const poolScroll = screen.getByTestId('deckbuilder-pool-scroll');
  fireEvent.contextMenu(within(poolScroll).getAllByText('Lightning Bolt')[0]);
}

describe('DeckBuilderPage registered-only allocation', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
  });

  it('keeps add actions enabled when only draft sibling decks use the same card', async () => {
    configureApi({
      poolQuantity: 2,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 0 },
        { id: 'deck-draft-sibling', status: 'draft', entries: [makeDeckEntry(1)], orderIndex: 1 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0));
    openPoolContextMenu();

    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeEnabled();
  });

  it('disables add actions when registered sibling decks consume all copies', async () => {
    configureApi({
      poolQuantity: 2,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 0 },
        { id: 'deck-registered', status: 'submitted', entries: [makeDeckEntry(2)], orderIndex: 1 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0));
    openPoolContextMenu();

    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeDisabled();
  });

  it('still disables add actions when active draft deck already used all copies', async () => {
    configureApi({
      poolQuantity: 1,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [makeDeckEntry(1)], orderIndex: 0 },
        { id: 'deck-draft-sibling', status: 'draft', entries: [], orderIndex: 1 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0));
    openPoolContextMenu();

    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeDisabled();
  });

  it('shows other-decks badge from registered decks only', async () => {
    configureApi({
      poolQuantity: 10,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 0 },
        { id: 'deck-registered', status: 'submitted', entries: [makeDeckEntry(2)], orderIndex: 1 },
        { id: 'deck-draft-sibling', status: 'draft', entries: [makeDeckEntry(3)], orderIndex: 2 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('other decks 2')).toBeInTheDocument());
    expect(screen.queryByText('other decks 5')).not.toBeInTheDocument();
  });
});
