import { screen, waitFor } from '@testing-library/react';
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

function makeDeckEntry() {
  return {
    cachedCardId: 'card-1',
    quantity: 1,
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

describe('DeckBuilderPage event-scoped leftover route', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
    mocks.authApiRequest.mockImplementation(async (path: string) => {
      if (path === '/api/events/e1/my-decklists') {
        return {
          data: {
            roundId: 'r2',
            roundNumber: 2,
            poolId: 'pool-1',
            matchesComplete: false,
            decklists: [
              {
                id: 'alice-req-0',
                orderIndex: 0,
                name: 'Alice Req 0',
                status: 'submitted',
                entries: [makeDeckEntry()],
              },
              {
                id: 'alice-req-1',
                orderIndex: 1,
                name: 'Alice Req 1',
                status: 'submitted',
                entries: [makeDeckEntry()],
              },
              {
                id: 'alice-extra-2',
                orderIndex: 2,
                name: 'Alice Extra',
                status: 'draft',
                entries: [makeDeckEntry()],
              },
            ],
            registeredCount: 2,
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
                    quantity: 4,
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
  });

  it('leftover round build route loads event my-decklists', async () => {
    renderWithAppProviders(
      <MemoryRouter initialEntries={['/events/e1/rounds/r2/build']}>
        <Routes>
          <Route path="/events/:eventId/build" element={<DeckBuilderPage />} />
          <Route path="/events/:eventId/rounds/:roundId/build" element={<DeckBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('deck-tab-alice-req-0')).toBeInTheDocument();
    });

    const requested = mocks.authApiRequest.mock.calls.map((call) => String(call[0]));
    expect(requested).toContain('/api/events/e1/my-decklists');
    expect(requested.some((path) => path === '/api/events/e1/rounds/r2/my-decklists')).toBe(false);

    expect(screen.getByTestId('deck-tab-alice-req-1')).toBeInTheDocument();
    expect(screen.getByTestId('deck-tab-alice-extra-2')).toBeInTheDocument();
    expect(screen.getByTestId('deck-tab-alice-req-0')).toHaveTextContent(/Registered/);
    expect(screen.getByTestId('deck-tab-alice-req-1')).toHaveTextContent(/Registered/);
  });
});
