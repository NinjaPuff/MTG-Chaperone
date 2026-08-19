import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  authApiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  authApiRequest: mocks.authApiRequest,
  ApiError: class ApiError extends Error {
    code?: string;
    fields?: Record<string, unknown>;
    constructor(message: string, options?: { code?: string; fields?: Record<string, unknown> }) {
      super(message);
      this.code = options?.code;
      this.fields = options?.fields;
    }
  },
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
  validateResponse?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    invalidCardIds?: string[];
  };
}) {
  const validateResponse = options?.validateResponse ?? {
    isValid: true,
    errors: [],
    warnings: [],
    invalidCardIds: [],
  };

  mocks.authApiRequest.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (path === '/api/events/e1/my-decklists') {
      return {
        data: {
          roundId: 'r1',
          roundNumber: 1,
          poolId: 'pool-1',
          registeredCount: 0,
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
                  quantity: 4,
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
                },
              ],
            },
          ],
        },
      };
    }
    if (path === '/api/decklists/deck-1/validate') {
      return { data: validateResponse };
    }
    if (path === '/api/decklists/deck-1/submit' && init?.method === 'POST') {
      return { data: null };
    }
    if (path === '/api/decklists/deck-1' && init?.method === 'PATCH') {
      return { data: null };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('DeckBuilderPage registration validation flow', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
  });

  it('blocks submit and shows validation dialog when validate fails', async () => {
    configureApi({
      validateResponse: {
        isValid: false,
        errors: ['Too many copies allocated for Lightning Bolt'],
        warnings: [],
        invalidCardIds: ['card-1'],
      },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-register-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('deck-register-button'));

    expect(await screen.findByText('Cannot register deck')).toBeInTheDocument();
    expect(screen.getByText(/Too many copies allocated for Lightning Bolt/)).toBeInTheDocument();
    expect(mocks.authApiRequest).not.toHaveBeenCalledWith('/api/decklists/deck-1/submit', { method: 'POST' });
  });

  it('should_show_cannot_register_when_validate_returns_size_error', async () => {
    configureApi({
      validateResponse: {
        isValid: false,
        errors: ['Main deck is below minimum size (39/40)'],
        warnings: [],
        invalidCardIds: [],
      },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-register-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('deck-register-button'));

    expect(await screen.findByText('Cannot register deck')).toBeInTheDocument();
    expect(screen.getByText(/Main deck is below minimum size \(39\/40\)/)).toBeInTheDocument();
    expect(mocks.authApiRequest).not.toHaveBeenCalledWith('/api/decklists/deck-1/submit', { method: 'POST' });
  });

  it('prompts with warnings before submit and proceeds when confirmed', async () => {
    configureApi({
      validateResponse: {
        isValid: true,
        errors: [],
        warnings: ['Sideboard count is 0; expected 15'],
        invalidCardIds: [],
      },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-register-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('deck-register-button'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Register with warnings?')).toBeInTheDocument();
    expect(within(dialog).getByText(/Sideboard count is 0; expected 15/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/decklists/deck-1/submit', { method: 'POST' });
    });
  });

  it('submits directly when validate has no warnings', async () => {
    configureApi({
      validateResponse: {
        isValid: true,
        errors: [],
        warnings: [],
        invalidCardIds: [],
      },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-register-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('deck-register-button'));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/decklists/deck-1/submit', { method: 'POST' });
    });
  });
});

