import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDashboardApiMock, makeEvent, makeMatch, makeRound } from '../helpers/matchFixtures';
import { renderDashboard } from '../helpers/dashboardTestHelpers';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authApiRequest: vi.fn(),
  useAuth: vi.fn(),
  useCurrentLeague: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  authApiRequest: mocks.authApiRequest,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock('@/hooks/useCurrentLeague', () => ({
  useCurrentLeague: () => mocks.useCurrentLeague(),
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

import { DashboardPage } from '@/pages/DashboardPage';

function configureDefaultMocks() {
  mocks.useAuth.mockReturnValue({ user: { id: 'u1', role: 'user' } });
  mocks.useCurrentLeague.mockReturnValue({
    league: { slug: 'test-league' },
    activeSeasonId: 's1',
    allSeasons: [
      { id: 's1', number: 1 },
      { id: 's2', number: 0 },
    ],
    isLoading: false,
  });
}

function configureDashboardWithRounds(rounds: ReturnType<typeof makeRound>[]) {
  const event = makeEvent();
  makeDashboardApiMock(mocks.apiRequest, {
    events: [event],
    standings: [],
    rounds,
    seasons: {
      s1: { events: [event], standings: [], rounds },
      s2: {
        events: [makeEvent({ id: 'e2', name: 'Old Event', status: 'completed' })],
        standings: [],
        rounds: [makeRound({ id: 'r-old', roundNumber: 1, matches: [makeMatch({ id: 'm-old' })] })],
      },
    },
  });
}

describe('DashboardPage active matches', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.authApiRequest.mockReset();
    configureDefaultMocks();
  });

  it('shows active matches section with report button for pending match', async () => {
    configureDashboardWithRounds([makeRound({ roundNumber: 3, matches: [makeMatch({ id: 'm1', status: 'pending' })] })]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Your Active Matches')).toBeInTheDocument();
    });
    expect(screen.getByText('Round 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View full schedule/i })).toHaveAttribute('href', '/schedule');
  });

  it('calls confirm API when non-reporter clicks Confirm', async () => {
    const match = makeMatch({
      id: 'm-reported',
      status: 'reported',
      reportedById: 'u2',
      gameResults: [{ winnerId: 'u1', isDraw: false }],
    });
    configureDashboardWithRounds([makeRound({ matches: [match] })]);
    mocks.authApiRequest.mockResolvedValue({ data: match });

    renderDashboard(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/matches/m-reported/confirm', { method: 'POST' });
    });
    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith('/api/events/e1/rounds');
    });
  });

  it('hides section when logged out', async () => {
    mocks.useAuth.mockReturnValue({ user: null });
    configureDashboardWithRounds([makeRound({ matches: [makeMatch()] })]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Active Event')).toBeInTheDocument();
    });
    expect(screen.queryByText('Your Active Matches')).not.toBeInTheDocument();
  });

  it('hides section when user has no active matches', async () => {
    configureDashboardWithRounds([makeRound({ matches: [makeMatch({ id: 'm-done', status: 'confirmed' })] })]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Your Rank')).toBeInTheDocument();
    });
    expect(screen.queryByText('Your Active Matches')).not.toBeInTheDocument();
  });

  it('hides section when viewing a past season', async () => {
    configureDashboardWithRounds([makeRound({ matches: [makeMatch()] })]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Your Active Matches')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's2' } });

    await waitFor(() => {
      expect(screen.queryByText('Your Active Matches')).not.toBeInTheDocument();
    });
  });

  it('hides reported match for the reporter', async () => {
    configureDashboardWithRounds([
      makeRound({
        matches: [makeMatch({ id: 'm-reported', status: 'reported', reportedById: 'u1', gameResults: [{ winnerId: 'u1', isDraw: false }] })],
      }),
    ]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Your Rank')).toBeInTheDocument();
    });
    expect(screen.queryByText('Your Active Matches')).not.toBeInTheDocument();
  });

  it('shows disputed match without action buttons', async () => {
    configureDashboardWithRounds([
      makeRound({
        matches: [
          makeMatch({
            id: 'm-disputed',
            status: 'disputed',
            reportedById: 'u2',
            gameResults: [{ winnerId: 'u1', isDraw: false }],
          }),
        ],
      }),
    ]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Your Active Matches')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Disputed')).toHaveLength(2);
    expect(screen.getByText('Awaiting admin resolution.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('opens report dialog when Report is clicked', async () => {
    configureDashboardWithRounds([makeRound({ matches: [makeMatch()] })]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByRole('heading', { name: 'Report Match' })).toBeInTheDocument();
  });

  it('does not show Next Match stat card when active matches are present', async () => {
    configureDashboardWithRounds([makeRound({ matches: [makeMatch()] })]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Your Active Matches')).toBeInTheDocument();
    });
    expect(screen.queryByText('Next Match')).not.toBeInTheDocument();
  });

  it('shows multiple active matches sorted by round number', async () => {
    configureDashboardWithRounds([
      makeRound({ id: 'r5', roundNumber: 5, matches: [makeMatch({ id: 'm-r5' })] }),
      makeRound({ id: 'r2', roundNumber: 2, matches: [makeMatch({ id: 'm-r2' })] }),
    ]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Round 2')).toBeInTheDocument();
    });
    expect(screen.getByText('Round 5')).toBeInTheDocument();
    const round2 = screen.getByText('Round 2');
    const round5 = screen.getByText('Round 5');
    expect(round2.compareDocumentPosition(round5) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('still renders rank and active event stat cards', async () => {
    configureDashboardWithRounds([makeRound({ matches: [makeMatch()] })]);
    renderDashboard(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Your Rank')).toBeInTheDocument();
    });
    expect(screen.getByText('Active Event')).toBeInTheDocument();
  });
});
