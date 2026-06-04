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

function configureApi() {
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
              entries: [],
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
              entries: [
                {
                  quantity: 4,
                  cachedCard: {
                    scryfallId: 'card-1',
                    name: 'Lightning Bolt',
                    manaCost: '{R}',
                    typeLine: 'Instant',
                    rarity: 'common',
                    setCode: 'LEA',
                    colorIdentity: ['R'],
                    imageUris: null,
                  },
                },
              ],
            },
          ],
        },
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('DeckBuilderPage layout', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
    configureApi();
  });

  it('should_render_work_area_with_viewport_height_class_on_xl', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });

    const workArea = screen.getByTestId('deckbuilder-work-area');
    expect(workArea.className).toMatch(/xl:h-\[calc\(100dvh-/);
    expect(workArea.className).toMatch(/xl:overflow-hidden/);
  });

  it('should_apply_pool_column_overflow_on_xl', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });

    const poolColumn = screen.getByTestId('deckbuilder-pool-column');
    expect(poolColumn.className).toMatch(/min-h-0/);
    expect(poolColumn.className).toMatch(/xl:overflow-y-auto/);
  });
});
