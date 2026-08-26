import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';
import { clearCardImageCachesForTests } from '@/lib/cardImage';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  authApiRequest: mocks.apiRequest,
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

type FixtureUser = {
  id: string;
  displayName: string;
  publicName: string | null;
  slug: string;
};

const alice: FixtureUser = { id: 'user-alice', displayName: 'Alice', publicName: null, slug: 'alice' };
const bob: FixtureUser = { id: 'user-bob', displayName: 'Bob', publicName: null, slug: 'bob' };
const carol: FixtureUser = { id: 'user-carol', displayName: 'Carol', publicName: null, slug: 'carol' };

const week1 = { id: 'week-1', name: 'Week 1', status: 'completed' as const, orderIndex: 1 };
const week2 = { id: 'week-2', name: 'Week 2', status: 'active' as const, orderIndex: 2 };
const w1r1 = { id: 'w1-r1', roundNumber: 1, status: 'completed' as const };
const w2r1 = { id: 'w2-r1', roundNumber: 1, status: 'completed' as const };
const w2r2 = { id: 'w2-r2', roundNumber: 2, status: 'in_progress' as const };

function deck(
  id: string,
  user: FixtureUser,
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
    entries: [
      {
        id: `${id}-e1`,
        quantity: 1,
        zone: 'main' as const,
          cachedCard: {
            scryfallId: `${id}-shock`,
            name: 'Shock',
            layout: 'normal',
            manaCost: '{R}',
            typeLine: 'Instant',
            cmc: 1,
            colorIdentity: ['R'],
            setCode: 'M10',
            collectorNumber: '146',
          },
      },
    ],
  };
}

const publicFixtures = [
  deck('alice-w1-reg', alice, week1, w1r1, 'submitted', 0, 'Alice Aggro'),
  deck('bob-w1-locked', bob, week1, w1r1, 'locked', 0, 'Bob Locked'),
  deck('alice-w2-r1', alice, week2, w2r1, 'submitted', 0, 'Alice Week2 R1'),
  deck('bob-w2-r2-draft', bob, week2, w2r2, 'draft', 0, 'Bob Current Draft'),
  deck('bob-w2-r2-sub', bob, week2, w2r2, 'submitted', 0, 'Bob Current Sub'),
  deck('alice-current-draft', alice, week2, w2r2, 'draft', 0, 'Alice Current'),
];

const leftoverDrafts = [
  deck('bob-w1-draft', bob, week1, w1r1, 'draft', 1, 'Bob Draft'),
  deck('carol-w1-draft', carol, week1, w1r1, 'draft', 0, 'Carol Midrange'),
];

const adminFixtures = [...publicFixtures, ...leftoverDrafts];

const aliceOwnerFixtures = [
  ...publicFixtures,
  deck('alice-w1-draft', alice, week1, w1r1, 'draft', 1, 'Alice Scratchpad'),
];

const seasonEvents = [
  { id: 'week-2', name: 'Week 2', status: 'active', orderIndex: 2 },
  { id: 'week-1', name: 'Week 1', status: 'completed', orderIndex: 1 },
];

function mockSeasonLoad(decks: ReturnType<typeof deck>[], visibility = true) {
  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path === '/api/seasons/season-1/events') {
      return { data: seasonEvents };
    }
    if (path === '/api/seasons/season-1/decklists') {
      return { data: decks, meta: { decklistVisibility: visibility } };
    }
    if (path.startsWith('/api/cards/')) {
      return { data: { imageUris: null } };
    }
    if (typeof path === 'string' && path.startsWith('/api/decklists/') && path.endsWith('/share')) {
      const decklistId = path.slice('/api/decklists/'.length, -'/share'.length);
      return { data: { token: `tok-${decklistId}` } };
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

describe('DecklistsPage league archive', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.useAuth.mockReturnValue({ user: charlie });
  });

  afterEach(() => {
    clearCardImageCachesForTests();
  });

  it('groups completed decks by event and orders groups by most recent event first', async () => {
    mockSeasonLoad(publicFixtures);
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
    mockSeasonLoad(publicFixtures);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Alice Aggro/)).toBeInTheDocument();
    });

    expect(requestedPaths()).toEqual(
      expect.arrayContaining(['/api/seasons/season-1/events', '/api/seasons/season-1/decklists']),
    );
    expect(requestedPaths().some((path) => path.includes('/api/decklists/my-season/'))).toBe(false);
    expect(screen.getByRole('heading', { name: 'League decks' })).toBeInTheDocument();
    expect(screen.getByText(/Bob Locked/)).toBeInTheDocument();
    expect(screen.getByText(/Alice Week2 R1/)).toBeInTheDocument();
    expect(screen.queryByText(/Carol Midrange/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob Draft/)).not.toBeInTheDocument();
    expect(screen.queryByText('Unregistered')).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob Current Draft/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob Current Sub/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unregister' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Current Deckbuilder' })).toBeInTheDocument();
  });

  it('lists only Bob’s registered archive deck in Week 1', async () => {
    mockSeasonLoad(publicFixtures);
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
    expect(bobSummaries).toHaveLength(1);
    expect(bobSummaries[0]).toMatch(/Bob Locked/);
    expect(bobSummaries[0]).toMatch(/Registered/);
    expect(bobSummaries[0]).not.toMatch(/Unregistered/);
  });

  it('puts Alice archive decks in Your previous decks and not in League decks', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(aliceOwnerFixtures);
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
    expect(within(yours as HTMLElement).getByText(/Alice Scratchpad/)).toBeInTheDocument();
    expect(within(yours as HTMLElement).getByText('Unregistered')).toBeInTheDocument();
    expect(within(league as HTMLElement).queryByText(/Alice Aggro/)).not.toBeInTheDocument();
    expect(within(league as HTMLElement).queryByText(/Alice Scratchpad/)).not.toBeInTheDocument();
    expect(within(league as HTMLElement).getByText(/Bob Locked/)).toBeInTheDocument();
    expect(within(league as HTMLElement).queryByText(/Carol Midrange/)).not.toBeInTheDocument();
  });

  it('hides current-round foreign drafts from the archive for admins', async () => {
    mocks.useAuth.mockReturnValue({ user: adminUser });
    mockSeasonLoad(adminFixtures);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Carol Midrange/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Bob Current Draft/)).not.toBeInTheDocument();
  });

  it('loads the season list for anonymous viewers without the builder CTA', async () => {
    mocks.useAuth.mockReturnValue({ user: null });
    mockSeasonLoad(publicFixtures);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Alice Aggro/)).toBeInTheDocument();
    });

    expect(requestedPaths().some((path) => path.includes('/api/decklists/my-season/'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Open Current Deckbuilder' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol Midrange/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob Draft/)).not.toBeInTheDocument();
    expect(screen.queryByText('Unregistered')).not.toBeInTheDocument();
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
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=bob');

    await waitFor(() => {
      expect(screen.getByText(/Bob Locked/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Alice Aggro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob Draft/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol Midrange/)).not.toBeInTheDocument();
  });

  it('shows an empty player copy when the query slug has no archive decks', async () => {
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=nobody');

    await waitFor(() => {
      expect(screen.getByText('No previous-round decks recorded for this player.')).toBeInTheDocument();
    });
  });

  it('titles the player-scoped archive for Bob and hides builder chrome', async () => {
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=bob');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "Bob's decklists" })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Decklists' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'League decks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your previous decks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Current Event Deck' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Current Deckbuilder' })).not.toBeInTheDocument();
    expect(screen.getByText('Browse previous-round decklists for this player.')).toBeInTheDocument();
    expect(screen.getByText(/Bob Locked/)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Draft/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alice Aggro/)).not.toBeInTheDocument();
  });

  it('hides builder chrome when Alice views her own player-scoped archive', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=alice');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "Alice's decklists" })).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { name: 'Current Event Deck' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Current Deckbuilder' })).not.toBeInTheDocument();
    expect(screen.getByText(/Alice Aggro/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your previous decks' })).not.toBeInTheDocument();
  });

  it("uses publicName for the player-scoped heading", async () => {
    const gus: FixtureUser = { id: 'user-gus', displayName: 'Google Name', publicName: 'Gus', slug: 'gus' };
    mockSeasonLoad([deck('gus-w1', gus, week1, w1r1, 'submitted', 0, 'Gus Aggro')]);
    renderPage('/decks?player=gus');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "Gus's decklists" })).toBeInTheDocument();
    });
  });

  it('uses the unknown-player heading when the slug matches no returned decklist', async () => {
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=nobody');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "This player's decklists" })).toBeInTheDocument();
    });
    expect(screen.getByText('No previous-round decks recorded for this player.')).toBeInTheDocument();
  });

  it('names the scoped heading from a non-archive season row', async () => {
    mockSeasonLoad([deck('bob-w2-r2-sub', bob, week2, w2r2, 'submitted', 0, 'Bob Current Sub')]);
    renderPage('/decks?player=bob');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "Bob's decklists" })).toBeInTheDocument();
    });
    expect(screen.getByText('No previous-round decks recorded for this player.')).toBeInTheDocument();
    expect(screen.queryByText(/Bob Current Sub/)).not.toBeInTheDocument();
  });

  it('keeps the player empty sentence when visibility is off and the payload is empty', async () => {
    mockSeasonLoad([], false);
    renderPage('/decks?player=bob');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "This player's decklists" })).toBeInTheDocument();
    });
    expect(screen.getByText('No previous-round decks recorded for this player.')).toBeInTheDocument();
    expect(screen.queryByText('Decklists are hidden for this season.')).not.toBeInTheDocument();
  });

  it('titles the player-scoped archive for guests without the builder CTA', async () => {
    mocks.useAuth.mockReturnValue({ user: null });
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=bob');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "Bob's decklists" })).toBeInTheDocument();
    });
    expect(screen.getByText('Browse previous-round decklists for this player.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Current Deckbuilder' })).not.toBeInTheDocument();
  });

  it('shows Alice her own archive on the scoped view when visibility is off', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(
      [
        deck('alice-w1-reg', alice, week1, w1r1, 'submitted', 0, 'Alice Aggro'),
        deck('alice-w2-r1', alice, week2, w2r1, 'submitted', 0, 'Alice Week2 R1'),
      ],
      false,
    );
    renderPage('/decks?player=alice');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "Alice's decklists" })).toBeInTheDocument();
    });
    expect(screen.getByText(/Alice Aggro/)).toBeInTheDocument();
    expect(screen.queryByText('Decklists are hidden for this season.')).not.toBeInTheDocument();
  });

  it('expands Bob Locked into a hoverable list then read-only Details', async () => {
    mockSeasonLoad([
      {
        ...deck('bob-w1-locked', bob, week1, w1r1, 'locked', 0, 'Bob Locked'),
        entries: [
          {
            id: 'm1',
            quantity: 2,
            zone: 'main' as const,
            cachedCard: {
              scryfallId: 'shock-1',
              name: 'Shock',
              layout: 'normal',
              manaCost: '{R}',
              typeLine: 'Instant',
              cmc: 1,
              colorIdentity: ['R'],
            },
          },
          {
            id: 's1',
            quantity: 1,
            zone: 'sideboard' as const,
            cachedCard: {
              scryfallId: 'negate-1',
              name: 'Negate',
              layout: 'normal',
              manaCost: '{1}{U}',
              typeLine: 'Instant',
              cmc: 2,
              colorIdentity: ['U'],
            },
          },
        ],
      },
    ]);
    renderPage('/decks');

    await waitFor(() => {
      expect(archiveDetails('Bob Locked')).toBeTruthy();
    });

    const details = archiveDetails('Bob Locked');
    expect(within(details).queryByRole('button', { name: 'Curve' })).not.toBeInTheDocument();
    expect(within(details).queryByText('Shock')).not.toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();

    const summary = details.querySelector('summary');
    expect(summary).not.toBeNull();
    fireEvent.click(summary as HTMLElement);
    if (within(details).queryByText('Shock') === null) {
      details.setAttribute('open', '');
      fireEvent(details, new Event('toggle'));
    }

    await waitFor(() => {
      expect(within(details).getByText('Shock')).toBeInTheDocument();
    });
    expect(within(details).getByText('Negate')).toBeInTheDocument();
    expect(within(details).getByRole('heading', { name: 'Main Deck' })).toBeInTheDocument();
    expect(within(details).getByRole('heading', { name: 'Sideboard' })).toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Curve' })).not.toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(details).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unregister' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('deck-analytics-enable-editing')).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole('button', { name: /Shock/ }));
    expect(within(details).queryByRole('button', { name: 'Curve' })).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole('button', { name: 'Details' }));
    await waitFor(() => {
      expect(within(details).getByRole('button', { name: 'Curve' })).toBeInTheDocument();
    });
    expect(within(details).getByText('Shock')).toBeInTheDocument();
    expect(within(details).getByText('Negate')).toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(details).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('deck-analytics-enable-editing')).not.toBeInTheDocument();
    expect(requestedPaths()).toEqual(
      expect.arrayContaining(['/api/seasons/season-1/events', '/api/seasons/season-1/decklists']),
    );
    expect(requestedPaths().some((path) => path.includes('/api/decklists/'))).toBe(false);

    fireEvent.click(within(details).getByRole('button', { name: 'Stacks' }));
    expect(within(details).queryByTestId('deck-analytics-combined-curve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deck-analytics-enable-editing')).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole('button', { name: 'List' }));
    expect(within(details).queryByRole('button', { name: 'Curve' })).not.toBeInTheDocument();
    expect(within(details).getByText('Shock')).toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(summary as HTMLElement);
    fireEvent.click(summary as HTMLElement);
    if (within(details).queryByText('Shock') === null) {
      details.setAttribute('open', '');
      fireEvent(details, new Event('toggle'));
    }
    await waitFor(() => {
      expect(within(details).getByText('Shock')).toBeInTheDocument();
    });
    expect(within(details).queryByRole('button', { name: 'Curve' })).not.toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps Share in the expanded row and lets Alice share Bob’s list', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(publicFixtures);
    renderPage();

    await waitFor(() => {
      expect(archiveDetails('Alice Aggro')).toBeTruthy();
    });

    const bobCollapsed = archiveDetails('Bob Locked');
    expect(within(bobCollapsed).queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();

    const aliceRow = expandArchive('Alice Aggro');
    const bobRow = expandArchive('Bob Locked');
    await waitFor(() => {
      expect(within(aliceRow).getByRole('button', { name: 'Share' })).toBeInTheDocument();
      expect(within(bobRow).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    });
    expect(aliceRow.querySelector('summary')).not.toContainElement(
      within(aliceRow).getByRole('button', { name: 'Share' }),
    );
    expect(within(aliceRow).getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(aliceRow.querySelector('summary')).not.toContainElement(
      within(aliceRow).getByRole('button', { name: 'Export' }),
    );

    fireEvent.click(within(bobRow).getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('dialog', { name: 'Export deck' })).toBeInTheDocument();
    expect(screen.getByTestId('deck-export-text')).toHaveTextContent('1 Shock (M10) 146');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(within(bobRow).getByRole('button', { name: 'Share' }));
    const url = (await screen.findByText(/\/share\/decks\/tok-bob-w1-locked/)).textContent ?? '';
    expect(url).toContain('/share/decks/tok-bob-w1-locked');
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/api/decklists/bob-w1-locked/share',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          ownerDisplayName: 'Bob',
          deckName: 'Bob Locked',
          eventName: 'Week 1',
        }),
      }),
    );
  });
});

describe('DecklistsPage share visibility', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  afterEach(() => {
    clearCardImageCachesForTests();
  });

  it('hides Share for guests even after expanding a row', async () => {
    mocks.useAuth.mockReturnValue({ user: null });
    mockSeasonLoad(publicFixtures);
    renderPage();
    await waitFor(() => {
      expect(archiveDetails('Bob Locked')).toBeTruthy();
    });
    expandArchive('Bob Locked');
    await waitFor(() => {
      expect(within(archiveDetails('Bob Locked')).getByText('Shock')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });

  it('keeps Share on Alice rows at /decks?player=alice', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=alice');
    await waitFor(() => {
      expect(archiveDetails('Alice Aggro')).toBeTruthy();
    });
    expandArchive('Alice Aggro');
    await waitFor(() => {
      expect(within(archiveDetails('Alice Aggro')).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    });
  });

  it('lets Alice share Bob’s player-scoped archive row', async () => {
    mocks.useAuth.mockReturnValue({ user: aliceUser });
    mockSeasonLoad(publicFixtures);
    renderPage('/decks?player=bob');
    await waitFor(() => {
      expect(archiveDetails('Bob Locked')).toBeTruthy();
    });
    expandArchive('Bob Locked');
    await waitFor(() => {
      expect(within(archiveDetails('Bob Locked')).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    });
  });

  it('lets an admin share Bob’s archive row', async () => {
    mocks.useAuth.mockReturnValue({ user: adminUser });
    mockSeasonLoad(publicFixtures);
    renderPage();
    await waitFor(() => {
      expect(archiveDetails('Bob Locked')).toBeTruthy();
    });
    expandArchive('Bob Locked');
    await waitFor(() => {
      expect(within(archiveDetails('Bob Locked')).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    });
  });
});
