import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authApiRequest: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  authApiRequest: mocks.authApiRequest,
  getStoredToken: vi.fn(() => null),
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock('@/hooks/useScryfallSets', () => ({
  useScryfallSets: () => ({
    getSet: () => undefined,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useCardImageWidth', () => ({
  useCardImageWidth: () => ({
    cardImageWidth: 160,
    setCardImageWidth: vi.fn(),
  }),
}));

import { CardPoolDetailPage } from '@/pages/CardPoolDetailPage';

const poolPayload = {
  pool: {
    id: 'pool-1',
    user: {
      id: 'owner-1',
      displayName: 'Owner',
      publicName: null,
      slug: 'owner',
      avatarUrl: null,
    },
    boosterProduct: {
      id: 'product-1',
      name: 'Draft Boosters',
      boosterType: 'draft',
      primarySetCode: 'DMU',
      setCodes: [{ id: 'set-1', setCode: 'DMU' }],
    },
    season: {
      id: 'season-1',
      name: 'Season 1',
      number: 1,
      league: { id: 'league-1', name: 'League', slug: 'league' },
    },
  },
  acquisitions: [
    {
      id: 'acq-1',
      phaseLabel: 'Phase 1',
      approvalStatus: 'approved',
      entries: [
        {
          id: 'entry-1',
          cachedCardId: 'card-p1',
          quantity: 1,
          cachedCard: {
            scryfallId: 'card-p1',
            name: 'Early Card',
            layout: null,
            setCode: 'DMU',
            imageUris: null,
            manaCost: '{1}{U}',
            typeLine: 'Creature — Wizard',
            rarity: 'common',
            cmc: 2,
            colors: ['U'],
            colorIdentity: ['U'],
          },
        },
      ],
    },
    {
      id: 'acq-2',
      phaseLabel: 'Phase 2',
      approvalStatus: 'approved',
      entries: [
        {
          id: 'entry-2',
          cachedCardId: 'card-p2',
          quantity: 1,
          cachedCard: {
            scryfallId: 'card-p2',
            name: 'Current Card',
            layout: null,
            setCode: 'DMU',
            imageUris: null,
            manaCost: '{1}{R}',
            typeLine: 'Instant',
            rarity: 'common',
            cmc: 2,
            colors: ['R'],
            colorIdentity: ['R'],
          },
        },
      ],
    },
  ],
};

function inProgressEvents() {
  return [
    { id: 'event-1', status: 'completed' },
    { id: 'event-2', status: 'active' },
    { id: 'event-3', status: 'setup' },
  ];
}

function completedEvents() {
  return [
    { id: 'event-1', status: 'completed' },
    { id: 'event-2', status: 'completed' },
  ];
}

function configureApi(events: Array<{ id: string; status: string }>) {
  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/card-pools/pool-1') {
      return { data: poolPayload };
    }
    if (path === '/api/seasons/season-1/events') {
      return { data: events };
    }
    throw new Error(`Unexpected path ${path}`);
  });
}

function renderPage() {
  return renderWithAppProviders(
    <MemoryRouter initialEntries={['/pools/pool-1']}>
      <Routes>
        <Route path="/pools/:poolId" element={<CardPoolDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CardPoolDetailPage owner adjust menu', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.authApiRequest.mockReset();
    mocks.useAuth.mockReturnValue({
      user: { id: 'owner-1', role: 'user' },
      isLoading: false,
    });
    configureApi(inProgressEvents());
  });

  it('should_open_adjust_menu_for_owner_on_allowed_phase_card', async () => {
    renderPage();

    expect(await screen.findByRole('option', { name: 'Phase 2' })).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId('pool-list-row-card-p2'));

    expect(await screen.findByRole('button', { name: 'Stage -1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stage All' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stage +1' })).not.toBeInTheDocument();

    const menu = screen.getByText('Manage this card in a specific acquisition group.').parentElement!;
    expect(within(menu).queryByRole('option', { name: 'Phase 1' })).not.toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: 'Phase 2' })).toBeInTheDocument();
  });

  it('should_not_open_adjust_menu_when_card_only_in_locked_phase', async () => {
    renderPage();

    expect(await screen.findByRole('option', { name: 'Phase 2' })).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId('pool-list-row-card-p1'));

    expect(screen.queryByText('Manage this card in a specific acquisition group.')).not.toBeInTheDocument();
  });

  it('should_not_open_adjust_menu_when_season_locked', async () => {
    configureApi(completedEvents());
    renderPage();

    expect(await screen.findByText(/Pool modifications are locked/)).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId('pool-list-row-card-p2'));

    expect(screen.queryByRole('button', { name: 'Stage -1' })).not.toBeInTheDocument();
    expect(screen.queryByText('Manage this card in a specific acquisition group.')).not.toBeInTheDocument();
  });

  it('should_list_all_matching_phases_in_menu_select_when_admin', async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: 'owner-1', role: 'admin' },
      isLoading: false,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('pool-list-row-card-p1')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByTestId('pool-list-row-card-p1'));

    expect(await screen.findByRole('button', { name: 'Stage +1' })).toBeInTheDocument();
    const menu = screen.getByText('Manage this card in a specific acquisition group.').parentElement!;
    expect(within(menu).getByRole('option', { name: 'Phase 1' })).toBeInTheDocument();
  });
});
