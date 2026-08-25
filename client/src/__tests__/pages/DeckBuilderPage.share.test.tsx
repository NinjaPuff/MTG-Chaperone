import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  authApiRequest: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  authApiRequest: mocks.authApiRequest,
  apiRequest: mocks.apiRequest,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'user', displayName: 'Alice', publicName: null },
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

const shockEntry = {
  cachedCardId: 'shock-1',
  quantity: 2,
  zone: 'main' as const,
  cachedCard: {
    name: 'Shock',
    layout: 'normal',
    manaCost: '{R}',
    typeLine: 'Instant',
    cmc: 1,
    colorIdentity: ['R'],
  },
};

const boltEntry = {
  cachedCardId: 'bolt-1',
  quantity: 1,
  zone: 'main' as const,
  cachedCard: {
    name: 'Lightning Bolt',
    layout: 'normal',
    manaCost: '{R}',
    typeLine: 'Instant',
    cmc: 1,
    colorIdentity: ['R'],
  },
};

function renderPage() {
  renderWithAppProviders(
    <MemoryRouter initialEntries={['/events/e1/build']}>
      <Routes>
        <Route path="/events/:eventId/build" element={<DeckBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function configureApi(options?: {
  deckStatus?: 'draft' | 'submitted' | 'locked';
  deckCount?: number;
  deckEntries?: typeof shockEntry[];
  secondDeckEntries?: typeof boltEntry[];
}) {
  const deckStatus = options?.deckStatus ?? 'draft';
  const deckCount = options?.deckCount ?? 1;
  const deckEntries = options?.deckEntries ?? [];

  mocks.authApiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/events/e1/my-decklists') {
      const decklists = [
        {
          id: 'deck-1',
          orderIndex: 0,
          name: 'Deck 1',
          status: deckStatus,
          entries: deckEntries,
        },
      ];
      if (deckCount > 1) {
        decklists.push({
          id: 'deck-2',
          orderIndex: 1,
          name: 'Deck 2',
          status: 'draft',
          entries: options?.secondDeckEntries ?? [boltEntry],
        });
      }
      return {
        data: {
          roundId: 'r1',
          roundNumber: 1,
          poolId: 'pool-1',
          registeredCount: deckStatus === 'draft' ? 0 : 1,
          decklists,
          eventConfig: {
            format: 'swiss',
            deckCount,
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
      return { data: { acquisitions: [] } };
    }
    if (path.includes('/validate')) {
      return { data: { valid: true, errors: [], warnings: [], invalidCardIds: [] } };
    }
    if (typeof path === 'string' && path.startsWith('/api/decklists/') && path.endsWith('/share')) {
      const decklistId = path.slice('/api/decklists/'.length, -'/share'.length);
      return { data: { token: `tok-${decklistId}` } };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('DeckBuilderPage share', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
    mocks.apiRequest.mockReset();
    configureApi({ deckEntries: [shockEntry] });
  });

  it('enables Share for draft, submitted, locked, and empty decks', async () => {
    for (const deckStatus of ['draft', 'submitted', 'locked'] as const) {
      mocks.authApiRequest.mockReset();
      configureApi({ deckStatus, deckEntries: [shockEntry] });
      const { unmount } = renderWithAppProviders(
        <MemoryRouter initialEntries={['/events/e1/build']}>
          <Routes>
            <Route path="/events/:eventId/build" element={<DeckBuilderPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('deck-share-button')).toBeEnabled();
      });
      expect(screen.getByTestId('deckbuilder-header-controls')).toContainElement(
        screen.getByTestId('deck-share-button'),
      );
      unmount();
    }

    mocks.authApiRequest.mockReset();
    configureApi({ deckEntries: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('deck-share-button')).toBeEnabled();
    });
  });

  it('POSTs only the active deck and does not mint until Share is clicked', async () => {
    configureApi({
      deckCount: 2,
      deckEntries: [shockEntry],
      secondDeckEntries: [boltEntry],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-share-button')).toBeEnabled();
    });
    const shareCallsAfterLoad = mocks.authApiRequest.mock.calls.filter((call) =>
      String(call[0]).includes('/share'),
    );
    expect(shareCallsAfterLoad).toEqual([]);
    expect(mocks.apiRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('deck-share-button'));
    const firstUrl = (await screen.findByText(/\/share\/decks\/tok-deck-1/)).textContent ?? '';
    expect(firstUrl).toContain('/share/decks/tok-deck-1');
    expect(firstUrl).not.toContain('#');
    expect(mocks.authApiRequest).toHaveBeenCalledWith(
      '/api/decklists/deck-1/share',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          ownerDisplayName: 'Alice',
          entries: [expect.objectContaining({ scryfallId: 'shock-1' })],
        }),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.change(screen.getByTestId('deck-tab-list'), { target: { value: 'deck-2' } });
    fireEvent.click(screen.getByTestId('deck-share-button'));
    const secondUrl = (await screen.findByText(/\/share\/decks\/tok-deck-2/)).textContent ?? '';
    expect(secondUrl).toContain('/share/decks/tok-deck-2');
    expect(secondUrl).not.toBe(firstUrl);
  });

  it('shares an empty deck as an empty snapshot and reuses the same URL when unchanged', async () => {
    configureApi({ deckEntries: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-share-button')).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId('deck-share-button'));
    const firstUrl = (await screen.findByText(/\/share\/decks\/tok-deck-1/)).textContent ?? '';
    expect(mocks.authApiRequest).toHaveBeenCalledWith(
      '/api/decklists/deck-1/share',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ entries: [] }),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByTestId('deck-share-button'));
    const secondUrl = (await screen.findByText(/\/share\/decks\/tok-deck-1/)).textContent ?? '';
    expect(secondUrl).toBe(firstUrl);
  });
});
