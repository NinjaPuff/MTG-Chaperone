import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authApiRequest: vi.fn(),
  role: 'user' as 'user' | 'admin',
  confirm: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  authApiRequest: mocks.authApiRequest,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: mocks.role },
  }),
}));

vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: mocks.confirm,
  }),
}));

vi.mock('@/hooks/useCurrentLeague', () => ({
  useCurrentLeague: () => ({
    league: { slug: 'test-league' },
    activeSeason: { number: 1 },
  }),
}));

vi.mock('@/hooks/useSeasonPoolSets', () => ({
  useSeasonPoolSets: () => ({
    poolSetsByUserId: new Map(),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useScryfallSets', () => ({
  useScryfallSets: () => ({
    getSet: vi.fn(),
  }),
}));

import { EventDetailPage } from '@/pages/EventDetailPage';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/events/e1']}>
      <Routes>
        <Route path="/events/:eventId" element={<EventDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function configureApi(
  eventStatus: 'setup' | 'active' | 'completed',
  rounds: Array<{ id: string; roundNumber: number; status: 'not_started' | 'in_progress' | 'completed'; matches: unknown[] }>,
  options?: {
    format?: 'swiss' | 'seeded_swiss' | 'round_robin' | 'single_elimination' | 'double_elimination' | 'custom_10_player';
    memberships?: Array<{ userId: string; user: { id: string; displayName: string } }>;
  },
) {
  const memberships = options?.memberships ?? [];
  const eventData = {
    id: 'e1',
    name: 'Week 1',
    status: eventStatus,
    pointMultiplier: 1,
    standingsOverride: false,
    totalRounds: null,
    config: {
      format: options?.format ?? 'swiss',
      bestOfN: 3,
      deckCount: 1,
      minDeckSize: 40,
      sideboardRule: 'entire_pool',
      schedulingType: 'open_window',
      deckLockingMode: 'free_modification',
      seedingSource: null,
    },
    season: {
      id: 's1',
      league: {
        id: 'l1',
        slug: 'test-league',
        memberships,
      },
    },
  };

  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/events/e1') {
      return { data: eventData };
    }
    if (path === '/api/events/e1/rounds') {
      return { data: rounds };
    }
    if (path === '/api/standings/s1') {
      return { data: [] };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('EventDetailPage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.authApiRequest.mockReset();
    mocks.confirm.mockReset();
    mocks.role = 'user';
  });

  it('shows build deck link when setup event has no rounds', async () => {
    configureApi('setup', []);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: 'Build Deck' });
    expect(link).toHaveAttribute('href', '/events/e1/build');
  });

  it('shows build deck link when active event has no rounds', async () => {
    configureApi('active', []);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Build Deck' })).toHaveAttribute('href', '/events/e1/build');
  });

  it('does not show build deck link when completed event has no rounds', async () => {
    configureApi('completed', []);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'Build Deck' })).not.toBeInTheDocument();
  });

  it('does not show standalone empty-state build deck link when rounds exist', async () => {
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [] }]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Round 1')).toBeInTheDocument();
    });

    expect(screen.queryByText('Pairings will be generated when the admin creates the first round.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Build Deck' })).toHaveLength(1);
  });

  it('shows edit settings for admins in setup and saves with PATCH', async () => {
    mocks.role = 'admin';
    configureApi('setup', []);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Settings' }));
    fireEvent.change(screen.getByLabelText('Event Name'), { target: { value: 'Week 1 Updated' } });
    fireEvent.change(screen.getByLabelText('Deck Count'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/events/e1', {
        method: 'PATCH',
        body: expect.objectContaining({
          name: 'Week 1 Updated',
          config: expect.objectContaining({ deckCount: 2 }),
        }),
      });
    });
  });

  it('shows reset event for active admin event and calls reset endpoint after confirmation', async () => {
    mocks.role = 'admin';
    mocks.confirm.mockResolvedValue(true);
    configureApi('active', []);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset Event' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset Event' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/events/e1/reset', { method: 'POST' });
    });
  });

  it('shows reset round for in-progress rounds and calls reset endpoint after confirmation', async () => {
    mocks.role = 'admin';
    mocks.confirm.mockResolvedValue(true);
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'in_progress', matches: [] }]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset Round' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset Round' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/rounds/r1/reset', { method: 'POST' });
    });
  });

  const leagueMemberships = [
    { userId: 'u1', user: { id: 'u1', displayName: 'Player One' } },
    { userId: 'u2', user: { id: 'u2', displayName: 'Player Two' } },
    { userId: 'u3', user: { id: 'u3', displayName: 'Player Three' } },
    { userId: 'u4', user: { id: 'u4', displayName: 'Player Four' } },
  ];

  const sampleMatch = {
    id: 'm1',
    status: 'pending',
    player1: { id: 'u1', displayName: 'Player One' },
    player2: { id: 'u2', displayName: 'Player Two' },
    gameResults: [],
    isBye: false,
    reportedById: null,
  };

  it('hides regenerate pairings for round robin but keeps edit pairings', async () => {
    mocks.role = 'admin';
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [sampleMatch] }], {
      format: 'round_robin',
      memberships: leagueMemberships,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Pairings' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Regenerate Pairings' })).not.toBeInTheDocument();
  });

  it('shows regenerate pairings for swiss events', async () => {
    mocks.role = 'admin';
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [sampleMatch] }], {
      format: 'swiss',
      memberships: leagueMemberships,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Regenerate Pairings' })).toBeInTheDocument();
    });
  });

  it('adds and removes pairing rows in the editor', async () => {
    mocks.role = 'admin';
    mocks.confirm.mockResolvedValue(true);
    mocks.authApiRequest.mockResolvedValue({});
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [sampleMatch] }], {
      format: 'round_robin',
      memberships: leagueMemberships,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Pairings' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Pairings' }));
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '+ Add pairing' }));
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]!);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/rounds/r1/pairings', {
        method: 'PUT',
        body: {
          pairings: [{ matchId: 'm1', player1Id: 'u1', player2Id: 'u2' }],
        },
      });
    });
  });

  it('sends new pairings without matchId when saving added rows', async () => {
    mocks.role = 'admin';
    mocks.confirm.mockResolvedValue(true);
    mocks.authApiRequest.mockResolvedValue({});
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [] }], {
      format: 'round_robin',
      memberships: leagueMemberships,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Pairings' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Pairings' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add pairing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/rounds/r1/pairings', {
        method: 'PUT',
        body: {
          pairings: [{ player1Id: 'u1', player2Id: 'u2' }],
        },
      });
    });
  });

  it('disables save all when add pairing introduces duplicate players', async () => {
    mocks.role = 'admin';
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [sampleMatch] }], {
      format: 'round_robin',
      memberships: leagueMemberships.slice(0, 2),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Pairings' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Pairings' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add pairing' }));

    expect(screen.getByRole('button', { name: 'Save All' })).toBeDisabled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  const unpairedConfirmPayload = {
    title: 'Save with unpaired players?',
    message: expect.stringMatching(/Player Three.*Player Four/),
    confirmLabel: 'Save All',
    variant: 'default' as const,
  };

  it('prompts to save when unpaired players remain and skips save on cancel', async () => {
    mocks.role = 'admin';
    mocks.confirm.mockResolvedValue(false);
    mocks.authApiRequest.mockResolvedValue({});
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [sampleMatch] }], {
      format: 'round_robin',
      memberships: leagueMemberships,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Pairings' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Pairings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalledWith(unpairedConfirmPayload);
    });

    expect(mocks.authApiRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save All' })).toBeInTheDocument();
  });

  it('prompts to save when unpaired players remain and saves on confirm', async () => {
    mocks.role = 'admin';
    mocks.confirm.mockResolvedValue(true);
    mocks.authApiRequest.mockResolvedValue({});
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [sampleMatch] }], {
      format: 'round_robin',
      memberships: leagueMemberships,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Pairings' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Pairings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalledWith(unpairedConfirmPayload);
    });

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/rounds/r1/pairings', {
        method: 'PUT',
        body: {
          pairings: [{ matchId: 'm1', player1Id: 'u1', player2Id: 'u2' }],
        },
      });
    });
  });

  it('does not prompt when all members are paired', async () => {
    mocks.role = 'admin';
    mocks.confirm.mockResolvedValue(true);
    mocks.authApiRequest.mockResolvedValue({});
    configureApi('active', [{ id: 'r1', roundNumber: 1, status: 'not_started', matches: [sampleMatch] }], {
      format: 'round_robin',
      memberships: leagueMemberships.slice(0, 2),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Pairings' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Pairings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/rounds/r1/pairings', {
        method: 'PUT',
        body: {
          pairings: [{ matchId: 'm1', player1Id: 'u1', player2Id: 'u2' }],
        },
      });
    });

    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
