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
}) {
  const deckStatus = options?.deckStatus ?? 'draft';
  const deckCount = options?.deckCount ?? 1;
  const registeredCount = options?.registeredCount ?? (deckStatus === 'draft' ? 0 : 1);
  const deckEntries = options?.deckEntries ?? [];

  mocks.authApiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
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
    if (path.startsWith('/api/decklists/') && init?.method === 'PATCH') {
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

  it('should_render_work_area_with_flex_height_on_large_screens', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });

    const pageRoot = screen.getByTestId('deckbuilder-page-root');
    expect(pageRoot.className).toMatch(/lg:overflow-hidden/);

    const workArea = screen.getByTestId('deckbuilder-work-area');
    expect(workArea.className).toMatch(/lg:min-h-0/);
    expect(workArea.className).not.toMatch(/lg:h-\[calc\(100dvh/);
    expect(workArea.className).toMatch(/flex-1/);
    expect(workArea.className).toMatch(/lg:overflow-hidden/);
    expect(workArea.className).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(300px,24vw\)\]/);
  });

  it('should_prevent_page_level_scroll_with_overflow_hidden_on_large_screens', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deckbuilder-work-area')).toBeInTheDocument();
    });

    const pageWrapper = screen.getByTestId('deckbuilder-page-root');
    expect(pageWrapper.className).toMatch(/lg:overflow-hidden/);
  });

  it('should_constrain_sidebar_column_for_viewport_filling_layout', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deckbuilder-sidebar-column')).toBeInTheDocument();
    });

    const sidebarColumn = screen.getByTestId('deckbuilder-sidebar-column');
    expect(sidebarColumn.className).toMatch(/min-h-0/);
    expect(sidebarColumn.className).toMatch(/h-full/);
    expect(sidebarColumn.className).toMatch(/overflow-hidden/);

    const sidebar = document.querySelector('aside')!;
    expect(sidebar.className).toMatch(/h-full/);
    expect(sidebar.className).toMatch(/min-h-0/);
    expect(sidebar.className).toMatch(/flex-col/);

    expect(within(sidebar).getByTestId('deck-sidebar-main-scroll')).toHaveClass('overflow-y-auto');
    expect(within(sidebar).getByTestId('deck-sidebar-main-scroll')).toHaveClass('flex-1');
    expect(within(sidebar).getByRole('button', { name: 'Basic Lands' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: /Sideboard/i })).toBeInTheDocument();
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

  it('shows 60-card target for extra prep decks in a 40-card event', async () => {
    configureApi({ extraDraftDeck: true, deckCount: 1, deckStatus: 'draft', registeredCount: 0 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('deck-tab-list')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('deck-tab-list'), { target: { value: 'deck-2' } });

    await waitFor(() => {
      expect(document.querySelector('aside')).toBeTruthy();
    });
    const sidebar = document.querySelector('aside')!;
    expect(within(sidebar).getByText('0/60')).toBeInTheDocument();
    expect(within(sidebar).getByTestId('deck-sidebar-prep-size-toggle')).toBeInTheDocument();
  });

  it('should_use_event_min_for_required_slot_when_extra_deck_exists', async () => {
    configureApi({ extraDraftDeck: true, deckCount: 1, deckStatus: 'draft', registeredCount: 0 });
    renderPage();

    await waitFor(() => {
      expect(document.querySelector('aside')).toBeTruthy();
    });
    const sidebar = document.querySelector('aside')!;
    expect(within(sidebar).getByText('0/40')).toBeInTheDocument();
    expect(within(sidebar).queryByTestId('deck-sidebar-prep-size-toggle')).not.toBeInTheDocument();
  });

  it('should_remove_main_card_from_details_when_editable_deck_card_clicked', async () => {
    configureApi({
      deckEntries: [
        {
          cachedCardId: 'card-1',
          quantity: 2,
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
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    const details = await screen.findByTestId('deckbuilder-details-area');
    const mainStat = within(details).getAllByText('Main Deck')[0].parentElement!;
    expect(mainStat).toHaveTextContent('2');

    fireEvent.click(within(details).getByText('Lightning Bolt'));
    expect(mainStat).toHaveTextContent('2');

    fireEvent.click(within(details).getByTestId('deck-analytics-enable-editing'));
    fireEvent.click(within(details).getByText('Lightning Bolt'));

    await waitFor(() => {
      expect(mainStat).toHaveTextContent('1');
    });
  });

  it('should_not_remove_details_card_when_deck_is_locked', async () => {
    configureApi({
      deckStatus: 'locked',
      deckEntries: [
        {
          cachedCardId: 'card-1',
          quantity: 2,
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
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    const details = await screen.findByTestId('deckbuilder-details-area');
    const mainStat = within(details).getAllByText('Main Deck')[0].parentElement!;
    expect(mainStat).toHaveTextContent('2');
    expect(within(details).getByTestId('deck-analytics-enable-editing')).toBeDisabled();

    fireEvent.click(within(details).getByText('Lightning Bolt'));

    expect(mainStat).toHaveTextContent('2');
  });

  it('should_reset_details_editing_when_leaving_and_returning', async () => {
    configureApi({
      deckEntries: [
        {
          cachedCardId: 'card-1',
          quantity: 2,
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
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    const details = await screen.findByTestId('deckbuilder-details-area');
    fireEvent.click(within(details).getByTestId('deck-analytics-enable-editing'));
    expect(within(details).getByTestId('deck-analytics-enable-editing')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    const returned = await screen.findByTestId('deckbuilder-details-area');
    expect(within(returned).getByTestId('deck-analytics-enable-editing')).not.toBeChecked();
  });
});
