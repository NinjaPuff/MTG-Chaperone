import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';
import { clearCardImageCachesForTests } from '@/lib/cardImage';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authApiRequest: vi.fn(),
  useAuth: vi.fn(),
  activeSeasonId: 'season-1' as string | null,
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
  useCurrentLeague: () => ({
    activeSeasonId: mocks.activeSeasonId,
    isLoading: false,
  }),
}));

import { AdminDeckChecksPage } from '@/pages/AdminDeckChecksPage';

const adminUser = { id: 'user-admin', role: 'admin' as const, displayName: 'Admin' };
const playerUser = { id: 'user-alice', role: 'user' as const, displayName: 'Alice' };

const aliceUser = { id: 'user-alice', displayName: 'Alice', publicName: null as string | null, slug: 'alice', avatarUrl: null };
const bobUser = { id: 'user-bob', displayName: 'Bob', publicName: null as string | null, slug: 'bob', avatarUrl: null };
const carolUser = { id: 'user-carol', displayName: 'Carol', publicName: null as string | null, slug: 'carol', avatarUrl: null };
const daveUser = { id: 'user-dave', displayName: 'Dave', publicName: null as string | null, slug: 'dave', avatarUrl: null };
const eveUser = { id: 'user-eve', displayName: 'Eve', publicName: null as string | null, slug: 'eve', avatarUrl: null };

const event = { id: 'week-2', name: 'Week 2', status: 'active' as const, orderIndex: 2 };
const round = { id: 'w2-r2', roundNumber: 2, status: 'in_progress' as const };

function cachedCard(name: string, scryfallId: string) {
  return {
    scryfallId,
    name,
    layout: 'normal',
    manaCost: name === 'Shock' ? '{R}' : '{1}{U}',
    typeLine: 'Instant',
    cmc: name === 'Shock' ? 1 : 2,
    colorIdentity: name === 'Shock' ? ['R'] : ['U'],
    setCode: 'M10',
    collectorNumber: '1',
  };
}

function officialDeck(id: string, user: typeof aliceUser, name: string, orderIndex: number, status: 'submitted' | 'locked' = 'submitted') {
  return {
    id,
    orderIndex,
    name,
    status,
    user,
    event,
    round,
    entries: [
      {
        id: `${id}-main`,
        quantity: 1,
        zone: 'main' as const,
        cachedCard: cachedCard('Shock', `${id}-shock`),
      },
      {
        id: `${id}-sb`,
        quantity: 1,
        zone: 'sideboard' as const,
        cachedCard: cachedCard('Negate', `${id}-negate`),
      },
    ],
  };
}

function player(user: typeof aliceUser, registeredCount: number, requiredCount = 2) {
  return { user, registeredCount, requiredCount };
}

function happyData(overrides?: Partial<ReturnType<typeof baseHappy>>) {
  return { ...baseHappy(), ...overrides };
}

function baseHappy() {
  return {
    emptyReason: null as string | null,
    season: { id: 'season-1', name: 'Season 1', decklistVisibility: false },
    event: { id: 'week-2', name: 'Week 2', status: 'active' as const },
    round: { id: 'w2-r2', roundNumber: 2, status: 'in_progress' as const },
    deckCount: 2,
    decklists: [
      officialDeck('alice-official', aliceUser, 'Alice Official', 0),
      officialDeck('bob-locked-0', bobUser, 'Bob Locked', 0, 'locked'),
      officialDeck('bob-sub-1', bobUser, 'Bob Second', 1),
    ],
    players: [
      player(aliceUser, 1),
      player(bobUser, 2),
      player(carolUser, 0),
      player(daveUser, 0),
      player(eveUser, 0),
    ],
  };
}

function emptyPayload(emptyReason: string) {
  return {
    emptyReason,
    season: emptyReason === 'no_active_season' ? null : { id: 'season-1', name: 'Season 1', decklistVisibility: false },
    event: emptyReason === 'no_current_round' ? { id: 'week-2', name: 'Week 2', status: 'active' } : null,
    round: null,
    deckCount: emptyReason === 'no_current_round' ? 2 : null,
    decklists: [],
    players: [],
  };
}

function renderPage(path = '/admin/deck-checks') {
  return renderWithAppProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/deck-checks" element={<AdminDeckChecksPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function archiveDetails(deckName: string): HTMLDetailsElement {
  const summary = screen.getByText((_, node) => {
    return node?.tagName === 'SUMMARY' && (node.textContent ?? '').includes(deckName);
  });
  const details = summary.closest('details');
  expect(details).not.toBeNull();
  return details as HTMLDetailsElement;
}

function expandArchive(deckName: string) {
  const details = archiveDetails(deckName);
  const summary = details.querySelector('summary');
  expect(summary).not.toBeNull();
  fireEvent.click(summary as HTMLElement);
  details.setAttribute('open', '');
  fireEvent(details, new Event('toggle'));
  return details;
}

describe('AdminDeckChecksPage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.authApiRequest.mockReset();
    mocks.activeSeasonId = 'season-1';
    mocks.useAuth.mockReturnValue({ user: adminUser, isLoading: false });
    mocks.authApiRequest.mockResolvedValue({ data: happyData() });
  });

  afterEach(() => {
    clearCardImageCachesForTests();
  });

  it('denies guests', async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Deck checks' })).toBeInTheDocument();
    expect(screen.getByText('You must be signed in to access admin tools.')).toBeInTheDocument();
    expect(mocks.authApiRequest).not.toHaveBeenCalled();
  });

  it('denies non-admin users', async () => {
    mocks.useAuth.mockReturnValue({ user: playerUser, isLoading: false });
    renderPage();

    expect(screen.getByText('You do not have admin access.')).toBeInTheDocument();
    expect(mocks.authApiRequest).not.toHaveBeenCalled();
  });

  it('lists registered players and the registration summary', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText(/Round 2/)).toBeInTheDocument();
    expect(screen.getByText('1/5 fully registered')).toBeInTheDocument();

    const summaries = screen.getAllByText((_, node) => node?.tagName === 'SUMMARY');
    expect(summaries.some((node) => (node.textContent ?? '').includes('Carol'))).toBe(false);
  });

  it('expands a registered list into List and Details without share or register', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Alice Official', { exact: false })).toBeInTheDocument();
    });

    const details = expandArchive('Alice Official');
    expect(within(details).getByText('Shock')).toBeInTheDocument();
    expect(within(details).getByText('Negate')).toBeInTheDocument();
    expect(within(details).getByRole('heading', { name: 'Main Deck' })).toBeInTheDocument();
    expect(within(details).getByRole('heading', { name: 'Sideboard' })).toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unregister' })).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole('button', { name: 'Details' }));
    await waitFor(() => {
      expect(within(details).getByRole('button', { name: 'Curve' })).toBeInTheDocument();
    });
  });

  it('filters both sections by primaryName', async () => {
    mocks.authApiRequest.mockResolvedValue({
      data: happyData({
        players: [
          player({ ...aliceUser, publicName: 'Gus' }, 1),
          player(bobUser, 2),
          player(carolUser, 0),
          player(daveUser, 0),
          player(eveUser, 0),
        ],
        decklists: [
          officialDeck('alice-official', { ...aliceUser, publicName: 'Gus' }, 'Alice Official', 0),
          officialDeck('bob-locked-0', bobUser, 'Bob Locked', 0, 'locked'),
        ],
      }),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Gus').length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'gus' } });
    expect(screen.getAllByText('Gus').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No players match your search.')).toBeInTheDocument();
  });

  it('shows incomplete registrations and hides fully registered players from that section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Not finished registering' })).toBeInTheDocument();
    });
    const incomplete = screen.getByRole('heading', { name: 'Not finished registering' }).closest('section')
      ?? screen.getByRole('heading', { name: 'Not finished registering' }).parentElement;
    expect(incomplete).toBeTruthy();
    expect(within(incomplete as HTMLElement).getByText('1/2')).toBeInTheDocument();
    expect(within(incomplete as HTMLElement).getAllByText('0/2').length).toBeGreaterThan(0);
    expect(within(incomplete as HTMLElement).getByText('Alice')).toBeInTheDocument();
    expect(within(incomplete as HTMLElement).getByText('Carol')).toBeInTheDocument();
    expect(within(incomplete as HTMLElement).queryByText('Bob')).not.toBeInTheDocument();
  });

  it.each([
    ['no_active_season', 'No active season.'],
    ['no_current_event', 'No current event.'],
    ['no_current_round', 'No current deckbuilder round.'],
  ] as const)('shows %s copy', async (reason, copy) => {
    mocks.authApiRequest.mockResolvedValue({ data: emptyPayload(reason) });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(copy)).toBeInTheDocument();
    });
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('shows zero-registration copy with the incomplete roster', async () => {
    mocks.authApiRequest.mockResolvedValue({
      data: happyData({
        decklists: [],
        players: [
          player(aliceUser, 0),
          player(bobUser, 0),
          player(carolUser, 0),
          player(daveUser, 0),
          player(eveUser, 0),
        ],
      }),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No registered lists for this round.')).toBeInTheDocument();
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    mocks.authApiRequest.mockRejectedValue(new Error('network'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Unable to load deck checks')).toBeInTheDocument();
    });
  });

  it('fetches with seasonId from the current league', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/admin/deck-checks?seasonId=season-1');
    });
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('prefers seasonId from the URL', async () => {
    renderPage('/admin/deck-checks?seasonId=season-other');

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/admin/deck-checks?seasonId=season-other');
    });
  });

  it('fetches without a query when no season id is available', async () => {
    mocks.activeSeasonId = null;
    renderPage();

    await waitFor(() => {
      expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/admin/deck-checks');
    });
  });
});
