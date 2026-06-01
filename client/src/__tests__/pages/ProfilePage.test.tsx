import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authApiRequest: vi.fn(),
  refreshUser: vi.fn(),
  useAuth: vi.fn(),
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

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  authApiRequest: mocks.authApiRequest,
  ApiError: mocks.ApiError,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

import { ProfilePage } from '@/pages/ProfilePage';

const googleUser = {
  id: 'user-1',
  displayName: 'Google Name',
  publicName: null,
  discordHandle: null,
  authProvider: 'google' as const,
  slug: 'google-name',
  avatarUrl: null,
  role: 'user' as const,
};

const publicProfile = {
  user: {
    id: 'user-1',
    displayName: 'Google Name',
    publicName: null,
    slug: 'google-name',
    avatarUrl: null,
    role: 'user' as const,
  },
  league: { slug: 'test-league', name: 'Test League' },
  activeSeason: {
    id: 'season-1',
    number: 1,
    name: 'Season 1',
    poolVisibility: true,
    decklistVisibility: true,
    scheduleVisibility: true,
  },
  currentStanding: {
    rank: 2,
    points: 9,
    matchWins: 3,
    matchLosses: 1,
    matchDraws: 0,
    omwPercent: 0.5,
    gwPercent: 0.5,
    ogwPercent: 0.5,
  },
  career: {
    seasonsPlayed: 1,
    totalMatches: 4,
    matchWins: 3,
    matchLosses: 1,
    matchDraws: 0,
    winRate: 0.75,
  },
  seasonHistory: [
    {
      seasonId: 'season-1',
      number: 1,
      name: 'Season 1',
      isActive: true,
      rank: 2,
      points: 9,
      matchWins: 3,
      matchLosses: 1,
      matchDraws: 0,
    },
  ],
  links: {
    poolId: 'pool-1',
    poolVisible: true,
    decklistsVisible: true,
  },
};

function renderProfile(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:slug" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.authApiRequest.mockReset();
    mocks.refreshUser.mockReset();
    mocks.refreshUser.mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({
      user: googleUser,
      isLoading: false,
      refreshUser: mocks.refreshUser,
    });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/users/google-name/match-history')) {
        return {
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
      }
      if (path === '/api/users/google-name') {
        return { data: publicProfile };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it('redirects /profile to the signed-in user slug', async () => {
    renderProfile('/profile');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Google Name' })).toBeInTheDocument();
    });
  });

  it('shows standings hint when visiting /profile logged out', () => {
    mocks.useAuth.mockReturnValue({
      user: null,
      isLoading: false,
      refreshUser: mocks.refreshUser,
    });

    renderProfile('/profile');

    expect(screen.getByText(/Choose a player from the/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'standings' })).toHaveAttribute('href', '/standings');
  });

  it('renders public profile sections for a slug', async () => {
    renderProfile('/profile/google-name');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Google Name' })).toBeInTheDocument();
    });
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Card Pool' })).toHaveAttribute('href', '/pools/pool-1');
  });

  it('submits profile edits with authApiRequest for owners', async () => {
    mocks.authApiRequest.mockResolvedValue({ data: googleUser });

    renderProfile('/profile/google-name');

    await waitFor(() => {
      expect(screen.getByLabelText(/Discord Handle/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Discord Handle/), { target: { value: 'my_handle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/users/profile', {
        method: 'PATCH',
        body: {
          publicName: null,
          discordHandle: 'my_handle',
        },
      });
    });
  });

  it('does not show edit form for other users profiles', async () => {
    mocks.useAuth.mockReturnValue({
      user: googleUser,
      isLoading: false,
      refreshUser: mocks.refreshUser,
    });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/users/other-user/match-history')) {
        return {
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
      }
      return {
        data: {
          ...publicProfile,
          user: { ...publicProfile.user, slug: 'other-user', displayName: 'Other User' },
        },
      };
    });

    renderProfile('/profile/other-user');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Other User' })).toBeInTheDocument();
    });
    expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
  });
});
