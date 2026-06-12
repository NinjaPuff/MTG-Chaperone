export type FixturePlayer = {
  id: string;
  displayName: string;
  publicName?: string | null;
  slug: string;
  avatarUrl?: string | null;
};

export type FixtureMatch = {
  id: string;
  status: 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
  player1: FixturePlayer;
  player2: FixturePlayer | null;
  gameResults: Array<{ id?: string; winnerId: string | null; isDraw: boolean }>;
  isBye: boolean;
  reportedById: string | null;
};

export type FixtureRound = {
  id: string;
  roundNumber: number;
  status: 'not_started' | 'in_progress' | 'completed';
  matches: FixtureMatch[];
};

export type FixtureEvent = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  config: {
    format: 'swiss' | 'seeded_swiss' | 'round_robin';
    bestOfN?: number;
  };
};

const defaultPlayer1: FixturePlayer = {
  id: 'u1',
  displayName: 'Alice',
  publicName: null,
  slug: 'alice',
};

const defaultPlayer2: FixturePlayer = {
  id: 'u2',
  displayName: 'Bob',
  publicName: null,
  slug: 'bob',
};

export function makeMatch(overrides: Partial<FixtureMatch> = {}): FixtureMatch {
  return {
    id: overrides.id ?? 'm1',
    status: overrides.status ?? 'pending',
    player1: overrides.player1 ?? defaultPlayer1,
    player2: overrides.player2 !== undefined ? overrides.player2 : defaultPlayer2,
    gameResults: overrides.gameResults ?? [],
    isBye: overrides.isBye ?? false,
    reportedById: overrides.reportedById ?? null,
  };
}

export function makeRound(overrides: Partial<FixtureRound> = {}): FixtureRound {
  return {
    id: overrides.id ?? 'r1',
    roundNumber: overrides.roundNumber ?? 1,
    status: overrides.status ?? 'in_progress',
    matches: overrides.matches ?? [],
  };
}

export function makeEvent(overrides: Partial<FixtureEvent> = {}): FixtureEvent {
  return {
    id: overrides.id ?? 'e1',
    name: overrides.name ?? 'Week 1',
    status: overrides.status ?? 'active',
    config: overrides.config ?? { format: 'swiss', bestOfN: 3 },
  };
}

type DashboardApiMockOptions = {
  events: FixtureEvent[];
  standings?: Array<{ userId: string; points: number }>;
  rounds: FixtureRound[];
  seasons?: Record<string, { events: FixtureEvent[]; standings: unknown[]; rounds: FixtureRound[] }>;
};

export function makeDashboardApiMock(
  apiRequest: { mockImplementation: (fn: (path: string) => Promise<unknown>) => void },
  options: DashboardApiMockOptions,
) {
  const seasons = options.seasons ?? {
    s1: {
      events: options.events,
      standings: options.standings ?? [],
      rounds: options.rounds,
    },
  };

  apiRequest.mockImplementation(async (path: string) => {
    const eventsMatch = path.match(/^\/api\/seasons\/([^/]+)\/events$/);
    if (eventsMatch) {
      const seasonId = eventsMatch[1];
      const season = seasons[seasonId];
      if (!season) {
        throw new Error(`Unexpected season: ${seasonId}`);
      }
      return { data: season.events };
    }

    const standingsMatch = path.match(/^\/api\/seasons\/([^/]+)\/standings$/);
    if (standingsMatch) {
      const seasonId = standingsMatch[1];
      const season = seasons[seasonId];
      if (!season) {
        throw new Error(`Unexpected season: ${seasonId}`);
      }
      return { data: season.standings };
    }

    const roundsMatch = path.match(/^\/api\/events\/([^/]+)\/rounds$/);
    if (roundsMatch) {
      const eventId = roundsMatch[1];
      for (const season of Object.values(seasons)) {
        const event = season.events.find((entry) => entry.id === eventId);
        if (event) {
          return { data: season.rounds };
        }
      }
      throw new Error(`Unexpected event: ${eventId}`);
    }

    throw new Error(`Unexpected path: ${path}`);
  });
}
