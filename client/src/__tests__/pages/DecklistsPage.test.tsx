import { screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock('@/hooks/useCurrentLeague', () => ({
  useCurrentLeague: () => ({
    activeSeasonId: 'season-1',
    isLoading: false,
  }),
}));

import { DecklistsPage } from '@/pages/DecklistsPage';

const charlie = { id: 'user-charlie', role: 'user' as const };
const aliceUser = { id: 'user-alice', role: 'user' as const };
const adminUser = { id: 'user-admin', role: 'admin' as const };

const alice = { id: 'user-alice', displayName: 'Alice', publicName: null, slug: 'alice' };
const bob = { id: 'user-bob', displayName: 'Bob', publicName: null, slug: 'bob' };
const carol = { id: 'user-carol', displayName: 'Carol', publicName: null, slug: 'carol' };

const week1 = { id: 'week-1', name: 'Week 1', status: 'completed' as const, orderIndex: 1 };
const week2 = { id: 'week-2', name: 'Week 2', status: 'active' as const, orderIndex: 2 };
const w1r1 = { id: 'w1-r1', roundNumber: 1, status: 'completed' as const };
const w2r1 = { id: 'w2-r1', roundNumber: 1, status: 'completed' as const };
const w2r2 = { id: 'w2-r2', roundNumber: 2, status: 'in_progress' as const };

function deck(
  id: string,
  user: typeof alice,
  event: typeof week1,
  round: typeof w1r1,
  status: 'draft' | 'submitted' | 'locked',
  orderIndex: number,
  name: string,
) {
  return {
    id,
    orderIndex,
    name,
    status,
    user,
    event,
    round,
    entries: [{ id: `${id}-e1`, quantity: 1, zone: 'main' as const, cachedCard: { name: 'Shock', manaCost: null } }],
  };
}

const fixtureSet = [
  deck('alice-w1-reg', alice, week1, w1r1, 'submitted', 0, 'Alice Aggro'),
  deck('bob-w1-locked', bob, week1, w1r1, 'locked', 0, 'Bob Locked'),
  deck('bob-w1-draft', bob, week1, w1r1, 'draft', 1, 'Bob Draft'),
  deck('carol-w1-draft', carol, week1, w1r1, 'draft', 0, 'Carol Midrange'),
  deck('alice-w2-r1', alice, week2, w2r1, 'submitted', 0, 'Alice Week2 R1'),
  deck('bob-w2-r2-draft', bob, week2, w2r2, 'draft', 0, 'Bob Current Draft'),
  deck('bob-w2-r2-sub', bob, week2, w2r2, 'submitted', 0, 'Bob Current Sub'),
  deck('alice-current-draft', alice, week2, w2r2, 'draft', 0, 'Alice Current'),
];

const seasonEvents = [
  { id: 'week-2', name: 'Week 2', status: 'active', orderIndex: 2 },
  { id: 'week-1', name: 'Week 1', status: 'completed', orderIndex: 1 },
];

function mockSeasonLoad(decks: typeof fixtureSet, visibility = true) {
  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/seasons/season-1/events') {
      return { data: seasonEvents };
    }
    if (path === '/api/seasons/season-1/decklists') {
      return { data: decks, meta: { decklistVisibility: visibility } };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

function requestedPaths() {
  return mocks.apiRequest.mock.calls.map((call) => String(call[0]));
}

function renderPage(path = '/decks') {
  renderWithAppProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/decks" element={<DecklistsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DecklistsPage league archive', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.useAuth.mockReturnValue({ user: charlie });
  });

  it('groups completed decks by event and orders groups by most recent event first', async () => {
    mockSeasonLoad(fixtureSet);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'League decks' })).toBeInTheDocument();
    });

    const section = screen.getByRole('heading', { name: 'League decks' }).closest('div');
    expect(section).toBeTruthy();
    const groups = within(section as HTMLElement).getAllByRole('heading', { level: 3 });
    expect(groups.map((node) => node.textContent)).toEqual(['Week 2', 'Week 1']);
  });

  it('shows empty state when there are no archive-round decks', async () => {
    mockSeasonLoad([
      deck('alice-current-draft', alice, week2, w2r2, 'draft', 0, 'Alice Current'),
      deck('bob-w2-r2-draft', bob, week2, w2r2, 'draft', 0, 'Bob Current Draft'),
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('No previous decklists yet.').length).toBeGreaterThan(0);
    });
  });

  it('loads the season list for logged-in Charlie and never calls my-season', async () => {
    mockSeasonLoad(fixtureSet);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Carol Midrange/)).toBeInTheDocument();
    });

    expect(requestedPaths()).toEqual(
      expect.arrayContaining(['/api/seasons/season-1/events', '/api/seasons/season-1/decklists']),
    );
    expect(requestedPaths().some((path) => path.includes('/api/decklists/my-season/'))).toBe(false);
    expect(screen.getByRole('heading', { name: 'League decks' })).toBeInTheDocument();
    expect(screen.getByText(/Alice Aggro/)).toBeInTheDocument();
    expect(screen.getByText(/Bob Locked/)).toBeInTheDocument();
    expect(screen.getByText(/Alice Week2 R1/)).toBeInTheDocument();
    expect(screen.getByText(/Carol Midrange/)).toBeInTheDocument();
    expect(screen.getAllByText('Unregistered').length).toBeGreaterThan(0);
    expect(screen.getByText(/Bob Draft/)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Current Draft/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob Current Sub/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unregister' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Current Deckbuilder' })).toBeInTheDocument();
  });

  it('lists Bob registered leftover above his unregistered leftover in Week 1', async () => {
    mockSeasonLoad(fixtureSet);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Bob Locked/)).toBeInTheDocument();
    });

    const week1Heading = screen.getByRole('heading', { name: 'Week 1' });
    const week1Section = week1Heading.parentElement;
    expect(week1Section).toBeTruthy();
    const summaries = [...(week1Section as HTMLElement).querySelectorAll('summary')].map(
      (node) => node.textContent ?? '',
    );
    const bobSummaries = summaries.filter((text) => text.includes('Bob'));
    expect(bobSummaries[0]).toMatch(/Bob Locked/);
    expect(bobSummaries[0]).toMatch(/Registered/);
    expect(bobSummaries[1]).toMatch(/Bob Draft/);
    expect(bobSummaries[1]).toMatch(/Unregistered/);
  });

  it('puts Alice archive decks in Your previous decks and not in League decks', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(fixtureSet);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your previous decks' })).toBeInTheDocument();
    });

    const yours = screen.getByRole('heading', { name: 'Your previous decks' }).closest('div');
    const league = screen.getByRole('heading', { name: 'League decks' }).closest('div');
    expect(yours).toBeTruthy();
    expect(league).toBeTruthy();
    expect(within(yours as HTMLElement).getByText(/Alice Aggro/)).toBeInTheDocument();
    expect(within(yours as HTMLElement).getByText(/Alice Week2 R1/)).toBeInTheDocument();
    expect(within(league as HTMLElement).queryByText(/Alice Aggro/)).not.toBeInTheDocument();
    expect(within(league as HTMLElement).getByText(/Bob Locked/)).toBeInTheDocument();
    expect(within(league as HTMLElement).getByText(/Carol Midrange/)).toBeInTheDocument();
  });

  it('hides current-round foreign drafts from the archive for admins', async () => {
    mocks.useAuth.mockReturnValue({ user: adminUser });
    mockSeasonLoad(fixtureSet);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Carol Midrange/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Bob Current Draft/)).not.toBeInTheDocument();
  });

  it('loads the season list for anonymous viewers without the builder CTA', async () => {
    mocks.useAuth.mockReturnValue({ user: null });
    mockSeasonLoad(fixtureSet);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Carol Midrange/)).toBeInTheDocument();
    });

    expect(requestedPaths().some((path) => path.includes('/api/decklists/my-season/'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Open Current Deckbuilder' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Unregistered').length).toBeGreaterThan(0);
  });

  it('shows hidden copy for signed-in Alice when season visibility is off', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(
      [
        deck('alice-w1-reg', alice, week1, w1r1, 'submitted', 0, 'Alice Aggro'),
        deck('alice-w2-r1', alice, week2, w2r1, 'submitted', 0, 'Alice Week2 R1'),
      ],
      false,
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Decklists are hidden for this season.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Decklists are hidden for this season. Sign in to view your own decklists.')).not.toBeInTheDocument();
  });

  it('keeps the guest hidden copy when season visibility is off', async () => {
    mocks.useAuth.mockReturnValue({ user: null });
    mockSeasonLoad([], false);
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Decklists are hidden for this season. Sign in to view your own decklists.'),
      ).toBeInTheDocument();
    });
  });

  it('filters the league archive to the player query param', async () => {
    mockSeasonLoad(fixtureSet);
    renderPage('/decks?player=bob');

    await waitFor(() => {
      expect(screen.getByText(/Bob Draft/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Alice Aggro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol Midrange/)).not.toBeInTheDocument();
  });

  it('shows an empty player copy when the query slug has no archive decks', async () => {
    mockSeasonLoad(fixtureSet);
    renderPage('/decks?player=nobody');

    await waitFor(() => {
      expect(screen.getByText('No previous-round decks recorded for this player.')).toBeInTheDocument();
    });
  });
});
