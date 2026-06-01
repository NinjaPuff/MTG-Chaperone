export const spectatorFixtures = {
  users: {
    alice: {
      id: 'user-alice',
      slug: 'alice',
      displayName: 'Alice',
      publicName: null,
      discordHandle: null,
      avatarUrl: null,
      role: 'user' as const,
    },
    bob: {
      id: 'user-bob',
      slug: 'bob',
      displayName: 'Bob',
      publicName: null,
      discordHandle: null,
      avatarUrl: null,
      role: 'user' as const,
    },
    admin: {
      id: 'user-admin',
      slug: 'admin',
      displayName: 'Admin',
      publicName: null,
      discordHandle: null,
      avatarUrl: null,
      role: 'admin' as const,
    },
  },
  league: {
    id: 'league-1',
    slug: 'test-league',
    name: 'Test League',
  },
  seasons: {
    visible: {
      id: 'season-1',
      leagueId: 'league-1',
      name: 'Season 1',
      number: 1,
      isActive: true,
      poolVisibility: true,
      decklistVisibility: true,
      scheduleVisibility: true,
    },
    hidden: {
      id: 'season-hidden',
      leagueId: 'league-1',
      name: 'Hidden Season',
      number: 2,
      isActive: false,
      poolVisibility: false,
      decklistVisibility: false,
      scheduleVisibility: false,
    },
  },
  pools: {
    alice: {
      id: 'pool-alice',
      userId: 'user-alice',
      seasonId: 'season-1',
    },
  },
  decklists: {
    aliceDraft: {
      id: 'decklist-alice-draft',
      userId: 'user-alice',
      status: 'draft' as const,
    },
    aliceSubmitted: {
      id: 'decklist-alice-submitted',
      userId: 'user-alice',
      status: 'submitted' as const,
    },
  },
};
