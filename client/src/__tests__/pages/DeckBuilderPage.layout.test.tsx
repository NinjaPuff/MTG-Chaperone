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

function configureApi(options?: {
  registeredCount?: number;
  deckStatus?: 'draft' | 'submitted' | 'locked';
  deckCount?: number;
  extraDraftDeck?: boolean;
}) {
  const deckStatus = options?.deckStatus ?? 'draft';
  const deckCount = options?.deckCount ?? 1;
  const registeredCount = options?.registeredCount ?? (deckStatus === 'draft' ? 0 : 1);

  mocks.authApiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/api/events/e1/my-decklists') {
      const decklists = [
        {
          id: 'deck-1',
          orderIndex: 0,
          name: 'Deck 1',
          status: deckStatus,
          entries: [],
        },
      ];
      if (options?.extraDraftDeck) {
        decklists.push({
          id: 'deck-2',
          orderIndex: deckCount,
          name: 'Extra Deck',
          status: 'draft',
          entries: [],
        });
      }
      return {
        data: {
          roundId: 'r1',
          roundNumber: 1,
          poolId: 'pool-1',
          registeredCount,
          decklists,
          eventConfig: {
            format: 'swiss',
            deckCount,
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
                    layout: null,
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
    if (path === '/api/decklists/deck-2' && init?.method === 'DELETE') {
      return { data: null };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('DeckBuilderPage layout', () => {
  beforeEach(() => {
    mocks.authApiRequest.mockReset();
    configureApi();
  });

  it('should_render_work_area_with_viewport_height_class_on_large_screens', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });

    const workArea = screen.getByTestId('deckbuilder-work-area');
    expect(workArea.className).toMatch(/lg:h-\[calc\(100dvh-9rem\)\]/);
    expect(workArea.className).toMatch(/lg:overflow-hidden/);
    expect(workArea.className).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(300px,24vw\)\]/);
  });

  it('should_use_tighter_viewport_height_on_work_area', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deckbuilder-work-area')).toBeInTheDocument();
    });

    expect(screen.getByTestId('deckbuilder-work-area').className).toMatch(
      /lg:h-\[calc\(100dvh-9rem\)\]/,
    );
  });

  it('should_pin_pool_toolbar_above_scrollable_card_list', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deckbuilder-pool-toolbar')).toBeInTheDocument();
    });

    const poolColumn = screen.getByTestId('deckbuilder-pool-column');
    expect(poolColumn.className).toMatch(/overflow-hidden/);
    expect(poolColumn.className).not.toMatch(/overflow-y-auto/);

    const toolbar = screen.getByTestId('deckbuilder-pool-toolbar');
    expect(toolbar.className).not.toMatch(/sticky/);

    const poolScroll = screen.getByTestId('deckbuilder-pool-scroll');
    expect(poolScroll).toHaveClass('overflow-y-auto');
    expect(poolScroll).toHaveClass('flex-1');
  });

  it('should_render_deck_tabs_and_build_details_in_page_header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deckbuilder-page-header')).toBeInTheDocument();
    });

    const header = screen.getByTestId('deckbuilder-page-header');
    expect(within(header).getByTestId('deck-tab-list')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Build' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Details' })).toBeInTheDocument();
  });

  it('should_not_render_build_toggle_inside_sidebar', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.querySelector('aside')).toBeTruthy();
    });

    const sidebar = document.querySelector('aside')!;
    expect(within(sidebar).queryByRole('button', { name: 'Build' })).not.toBeInTheDocument();
  });

  it('should_switch_to_details_with_single_build_toggle', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getAllByRole('button', { name: 'Build' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Curve' })).toBeInTheDocument();
    expect(screen.queryByTestId('deckbuilder-work-area')).not.toBeInTheDocument();
  });

  it('should_return_to_build_mode_from_header_toggle', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));

    expect(screen.getByTestId('deckbuilder-work-area')).toBeInTheDocument();
  });

  it('renders the view toggle on a separate row below deck controls', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-view-toggle')).toBeInTheDocument();
    });

    const controls = screen.getByTestId('deckbuilder-header-controls');
    const viewRow = screen.getByTestId('deckbuilder-header-view-row');
    const viewToggle = screen.getByTestId('deck-view-toggle');
    const deleteButton = screen.getByTestId('deck-delete-button');

    expect(controls.contains(viewToggle)).toBe(false);
    expect(viewRow.contains(viewToggle)).toBe(true);
    expect(controls.contains(deleteButton)).toBe(true);
    expect(controls.compareDocumentPosition(viewRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(viewToggle).getByText('View')).toBeInTheDocument();
  });

  it('requires confirmation before deleting an extra draft deck', async () => {
    configureApi({ extraDraftDeck: true });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-tab-list')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('deck-tab-list'), { target: { value: 'deck-2' } });

    await waitFor(() => {
      expect(screen.getByTestId('deck-delete-button')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('deck-delete-button'));

    expect(screen.getByText('Delete deck')).toBeInTheDocument();
    expect(screen.getByText(/Delete "Extra Deck"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.authApiRequest).not.toHaveBeenCalledWith('/api/decklists/deck-2', { method: 'DELETE' });

    fireEvent.click(screen.getByTestId('deck-delete-button'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/decklists/deck-2', { method: 'DELETE' });
    });
  });

  it('shows registration counter and disables register at cap', async () => {
    configureApi({ deckStatus: 'draft', deckCount: 1, registeredCount: 1 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-registration-counter')).toHaveTextContent('1/1');
    });

    expect(screen.getByTestId('deck-register-button')).toBeDisabled();
    expect(screen.getByTestId('deck-unregister-button')).toBeDisabled();
    expect(screen.getByTestId('deck-delete-button')).toBeDisabled();
  });
});
