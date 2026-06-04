import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
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

vi.mock('@/hooks/useCurrentLeague', () => ({
  useCurrentLeague: () => ({
    league: { slug: 'test-league', name: 'Test League' },
    activeSeason: { number: 1 },
    activeSeasonId: 'season-1',
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useScryfallSets', () => ({
  useScryfallSets: () => ({
    getSet: () => undefined,
    isLoading: false,
  }),
}));

import { CardPoolsPage } from '@/pages/CardPoolsPage';

const signedInUser = {
  id: 'user-a',
  displayName: 'Alice',
  publicName: null,
  discordHandle: null,
  authProvider: 'google' as const,
  slug: 'alice',
  avatarUrl: null,
  role: 'user' as const,
};

function makePool(
  id: string,
  userId: string,
  displayName: string,
  productName: string,
): {
  id: string;
  user: {
    id: string;
    displayName: string;
    publicName: null;
    discordHandle: null;
    slug: string;
    avatarUrl: null;
  };
  boosterProduct: {
    id: string;
    name: string;
    boosterType: 'draft';
    primarySetCode: string;
    setCodes: Array<{ id: string; setCode: string }>;
  };
} {
  return {
    id,
    user: {
      id: userId,
      displayName,
      publicName: null,
      discordHandle: null,
      slug: displayName.toLowerCase(),
      avatarUrl: null,
    },
    boosterProduct: {
      id: `product-${id}`,
      name: productName,
      boosterType: 'draft',
      primarySetCode: 'DMU',
      setCodes: [{ id: '1', setCode: 'DMU' }],
    },
  };
}

const alicePool = makePool('pool-a', 'user-a', 'Alice', 'Alice Product');
const bobPool = makePool('pool-b', 'user-b', 'Bob', 'Bob Product');

function renderPage() {
  return render(
    <MemoryRouter>
      <CardPoolsPage />
    </MemoryRouter>,
  );
}

describe('CardPoolsPage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.includes('/pools')) {
        return { data: [alicePool, bobPool], meta: { poolVisibility: true } };
      }
      if (path.includes('/members')) {
        return { data: [{ id: 'm-1', user: { id: 'user-a' } }] };
      }
      return { data: [] };
    });
  });

  it('should_not_show_your_pool_section_when_guest', async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    expect(screen.queryByText('Your pool')).not.toBeInTheDocument();
    expect(screen.queryByText(/admin still needs to assign your set/)).not.toBeInTheDocument();

    const memberCalls = mocks.apiRequest.mock.calls.filter(([path]) => String(path).includes('/members'));
    expect(memberCalls).toHaveLength(0);
  });

  it('should_not_show_your_pool_section_when_signed_in_non_member', async () => {
    mocks.useAuth.mockReturnValue({
      user: { ...signedInUser, id: 'user-x', displayName: 'Outsider', slug: 'outsider' },
      isLoading: false,
    });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.includes('/pools')) {
        return { data: [alicePool, bobPool], meta: { poolVisibility: true } };
      }
      if (path.includes('/members')) {
        return { data: [{ id: 'm-1', user: { id: 'user-a' } }] };
      }
      return { data: [] };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    expect(screen.queryByText('Your pool')).not.toBeInTheDocument();
    expect(screen.queryByText(/admin still needs to assign your set/)).not.toBeInTheDocument();
  });

  it('should_show_your_pool_section_with_link_when_member_has_pool', async () => {
    mocks.useAuth.mockReturnValue({ user: signedInUser, isLoading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Your pool')).toBeInTheDocument();
    });

    const yourPoolLink = screen.getByRole('link', { name: /Alice Product/i });
    expect(yourPoolLink).toHaveAttribute('href', '/pools/pool-a');

    expect(screen.getAllByText('Alice')).toHaveLength(1);
  });

  it('should_list_other_pools_under_all_pools_heading', async () => {
    mocks.useAuth.mockReturnValue({ user: signedInUser, isLoading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('All pools')).toBeInTheDocument();
    });

    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should_show_admin_assignment_notice_when_member_has_no_pool', async () => {
    mocks.useAuth.mockReturnValue({ user: signedInUser, isLoading: false });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.includes('/pools')) {
        return { data: [bobPool], meta: { poolVisibility: true } };
      }
      if (path.includes('/members')) {
        return { data: [{ id: 'm-1', user: { id: 'user-a' } }] };
      }
      return { data: [] };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/admin still needs to assign your set/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /Alice Product/i })).not.toBeInTheDocument();
  });

  it('should_show_no_other_pools_when_member_has_no_pool_and_list_empty', async () => {
    mocks.useAuth.mockReturnValue({ user: signedInUser, isLoading: false });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.includes('/pools')) {
        return { data: [], meta: { poolVisibility: true } };
      }
      if (path.includes('/members')) {
        return { data: [{ id: 'm-1', user: { id: 'user-a' } }] };
      }
      return { data: [] };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No other pools registered.')).toBeInTheDocument();
    });

    expect(screen.queryByText('No pools registered.')).not.toBeInTheDocument();
    expect(screen.getByText(/admin still needs to assign your set/)).toBeInTheDocument();
  });

  it('should_show_your_pool_from_filtered_api_when_pool_visibility_hidden', async () => {
    mocks.useAuth.mockReturnValue({ user: signedInUser, isLoading: false });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.includes('/pools')) {
        return { data: [alicePool], meta: { poolVisibility: false } };
      }
      if (path.includes('/members')) {
        return { data: [{ id: 'm-1', user: { id: 'user-a' } }] };
      }
      return { data: [] };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Your pool')).toBeInTheDocument();
    });

    expect(screen.getByText('No other pools registered.')).toBeInTheDocument();
    expect(screen.getAllByText('Alice')).toHaveLength(1);
  });
});
