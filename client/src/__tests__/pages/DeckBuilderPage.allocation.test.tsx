import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  matchesComplete?: boolean;
  deckCount?: number;
}) {
  mocks.authApiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/events/e1/my-decklists') {
      return {
        data: {
          roundId: 'r1',
          roundNumber: 1,
          poolId: 'pool-1',
          matchesComplete: options.matchesComplete ?? false,
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
            deckCount: options.deckCount ?? 2,
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

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
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

  it('lets extra drafts reuse registered copies after matches complete', async () => {
    configureApi({
      poolQuantity: 2,
      matchesComplete: true,
      deckCount: 1,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 1 },
        { id: 'deck-registered', status: 'submitted', entries: [makeDeckEntry(2)], orderIndex: 0 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0));
    openPoolContextMenu();

    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeEnabled();
    expect(screen.queryByText('other decks 2')).not.toBeInTheDocument();
  });

  it('lets leftover slot 0 drafts reuse registered copies after matches complete', async () => {
    configureApi({
      poolQuantity: 2,
      matchesComplete: true,
      deckCount: 1,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 0 },
        { id: 'deck-registered', status: 'submitted', entries: [makeDeckEntry(2)], orderIndex: 1 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0));
    openPoolContextMenu();

    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeEnabled();
    expect(screen.queryByText('other decks 2')).not.toBeInTheDocument();
  });

  it('does not count other extra drafts when matches are complete', async () => {
    configureApi({
      poolQuantity: 2,
      matchesComplete: true,
      deckCount: 1,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 1 },
        { id: 'deck-extra-sibling', status: 'draft', entries: [makeDeckEntry(2)], orderIndex: 2 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0));
    expect(screen.queryByText('other decks 2')).not.toBeInTheDocument();
    openPoolContextMenu();

    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeEnabled();
  });

  it('shows no other-decks badge when two extras share a pool-1 card after matches complete', async () => {
    configureApi({
      poolQuantity: 1,
      matchesComplete: true,
      deckCount: 1,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [makeDeckEntry(1)], orderIndex: 1 },
        { id: 'deck-extra-sibling', status: 'draft', entries: [makeDeckEntry(1)], orderIndex: 2 },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('in deck 1')).toBeInTheDocument());
    expect(screen.queryByText('other decks 1')).not.toBeInTheDocument();
  });

  it('shows reuse helper copy for a leftover draft after matches complete', async () => {
    const helperCopy = 'Matches are done. This deck may reuse cards from registered lists.';

    configureApi({
      poolQuantity: 2,
      matchesComplete: true,
      deckCount: 1,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 1 },
        { id: 'deck-registered', status: 'submitted', entries: [makeDeckEntry(2)], orderIndex: 0 },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(helperCopy)).toBeInTheDocument());
  });

  it('hides reuse helper copy when extra-deck matches are not complete', async () => {
    configureApi({
      poolQuantity: 2,
      matchesComplete: false,
      deckCount: 1,
      decks: [
        { id: 'deck-active', status: 'draft', entries: [], orderIndex: 1 },
        { id: 'deck-registered', status: 'submitted', entries: [makeDeckEntry(2)], orderIndex: 0 },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0));
    expect(
      screen.queryByText('Matches are done. This deck may reuse cards from registered lists.'),
    ).not.toBeInTheDocument();
  });

  it('shows reuse helper copy on a leftover slot 0 draft after matches complete', async () => {
    const helperCopy = 'Matches are done. This deck may reuse cards from registered lists.';
    configureApi({
      poolQuantity: 2,
      matchesComplete: true,
      deckCount: 1,
      decks: [{ id: 'deck-active', status: 'draft', entries: [], orderIndex: 0 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(helperCopy)).toBeInTheDocument());
  });

  it('refreshes extra reuse on visibility without replacing decks', async () => {
    const helperCopy = 'Matches are done. This deck may reuse cards from registered lists.';
    let matchesComplete = false;
    let serverExtraName = 'Local Extra';
    mocks.authApiRequest.mockImplementation(async (path: string) => {
      if (path === '/api/events/e1/my-decklists') {
        return {
          data: {
            roundId: 'r1',
            roundNumber: 1,
            poolId: 'pool-1',
            matchesComplete,
            decklists: [
              {
                id: 'deck-active',
                orderIndex: 1,
                name: serverExtraName,
                status: 'draft',
                entries: [],
              },
              {
                id: 'deck-registered',
                orderIndex: 0,
                name: 'Deck 1',
                status: 'submitted',
                entries: [makeDeckEntry(2)],
              },
            ],
            registeredCount: 1,
            eventConfig: {
              format: 'swiss',
              deckCount: 1,
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
                    quantity: 2,
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

    renderPage();
    await waitFor(() => expect(screen.getByTestId('deck-tab-deck-active')).toHaveTextContent('Local Extra'));
    expect(screen.queryByText(helperCopy)).not.toBeInTheDocument();
    openPoolContextMenu();
    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeDisabled();

    const myDecklistsBefore = mocks.authApiRequest.mock.calls.filter(
      (call) => call[0] === '/api/events/e1/my-decklists',
    ).length;
    const poolBefore = mocks.authApiRequest.mock.calls.filter(
      (call) => call[0] === '/api/card-pools/pool-1',
    ).length;
    expect(myDecklistsBefore).toBe(1);
    expect(poolBefore).toBe(1);

    matchesComplete = true;
    serverExtraName = 'Hijacked Extra';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => {
      expect(screen.getByText(helperCopy)).toBeInTheDocument();
    });
    openPoolContextMenu();
    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeEnabled();
    expect(screen.getByTestId('deck-tab-deck-active')).toHaveTextContent('Local Extra');
    expect(screen.queryByText('Hijacked Extra')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading deckbuilder...')).not.toBeInTheDocument();
    expect(
      mocks.authApiRequest.mock.calls.filter((call) => call[0] === '/api/events/e1/my-decklists'),
    ).toHaveLength(2);
    expect(
      mocks.authApiRequest.mock.calls.filter((call) => call[0] === '/api/card-pools/pool-1'),
    ).toHaveLength(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(
      mocks.authApiRequest.mock.calls.filter((call) => call[0] === '/api/events/e1/my-decklists'),
    ).toHaveLength(2);
  });
});

