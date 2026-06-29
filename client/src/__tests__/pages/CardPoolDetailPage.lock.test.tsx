import { render, screen, waitFor } from '@testing-library/react';
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
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(status: number, payload: { code: string; message: string }) {
      super(payload.message);
      this.code = payload.code;
      this.status = status;
    }
  },
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

const poolOwnerId = 'user-owner';
const seasonId = 'season-1';

const poolDetail = {
  id: 'pool-1',
  user: {
    id: poolOwnerId,
    displayName: 'Alice',
    publicName: null,
    slug: 'alice',
    avatarUrl: null,
  },
  boosterProduct: {
    id: 'product-1',
    name: 'Draft Boosters',
    boosterType: 'draft' as const,
    primarySetCode: 'DMU',
    setCodes: [{ id: 'set-1', setCode: 'DMU' }],
  },
  season: {
    id: seasonId,
    name: 'Season 1',
    number: 1,
    league: {
      id: 'league-1',
      name: 'Test League',
      slug: 'test-league',
    },
  },
};

function completedSeasonEvents() {
  return [
    { id: 'event-1', status: 'completed' as const },
    { id: 'event-2', status: 'completed' as const },
  ];
}

function inProgressSeasonEvents() {
  return [
    { id: 'event-1', status: 'completed' as const },
    { id: 'event-2', status: 'active' as const },
    { id: 'event-3', status: 'setup' as const },
  ];
}

function configureApi(role: 'user' | 'admin', events = completedSeasonEvents()) {
  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/card-pools/pool-1') {
      return { data: { pool: poolDetail, acquisitions: [] } };
    }
    if (path === `/api/seasons/${seasonId}/events`) {
      return { data: events };
    }
    throw new Error(`Unexpected path: ${path} (role=${role})`);
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

describe('CardPoolDetailPage season lock UI', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.authApiRequest.mockReset();
  });

  it('hides owner modification controls and shows locked banner when all events are completed', async () => {
    configureApi('user');
    mocks.useAuth.mockReturnValue({
      user: {
        id: poolOwnerId,
        role: 'user',
        displayName: 'Alice',
        publicName: null,
        slug: 'alice',
        avatarUrl: null,
        authProvider: 'google',
      },
      isLoading: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pool modifications are locked/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('combobox', { name: 'Search cards' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bulk Add Cards' })).not.toBeInTheDocument();
    expect(screen.queryByText('Staged Changes')).not.toBeInTheDocument();
  });

  it('shows admin controls without locked banner when season is locked', async () => {
    configureApi('admin');
    mocks.useAuth.mockReturnValue({
      user: {
        id: 'admin-user',
        role: 'admin',
        displayName: 'Admin',
        publicName: null,
        slug: 'admin',
        avatarUrl: null,
        authProvider: 'google',
      },
      isLoading: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Admin tip:/)).toBeInTheDocument();
    });

    expect(screen.getByText('Staged Changes')).toBeInTheDocument();
    expect(screen.queryByText(/Pool modifications are locked/)).not.toBeInTheDocument();
  });

  it('shows current and next phase options for non-admin owners adding cards', async () => {
    configureApi('user', inProgressSeasonEvents());
    mocks.useAuth.mockReturnValue({
      user: {
        id: poolOwnerId,
        role: 'user',
        displayName: 'Alice',
        publicName: null,
        slug: 'alice',
        avatarUrl: null,
        authProvider: 'google',
      },
      isLoading: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Add Cards')).toBeInTheDocument();
      expect(screen.getByLabelText('Phase Label')).toHaveValue('Phase 2');
    });

    const phaseSelect = screen.getByLabelText('Phase Label');
    expect(screen.getByRole('option', { name: 'Phase 2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Phase 3' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Phase 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Phase 4' })).not.toBeInTheDocument();
    expect(phaseSelect.tagName).toBe('SELECT');
  });
});
