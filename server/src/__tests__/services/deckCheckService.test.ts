import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { spectatorFixtures } from '../helpers/spectatorFixtures.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { getAdminDeckChecks } from '../../services/deckCheckService.js';

const alice = spectatorFixtures.users.alice;
const bob = spectatorFixtures.users.bob;
const carol = {
  id: 'user-carol',
  slug: 'carol',
  displayName: 'Carol',
  publicName: null,
  discordHandle: null,
  avatarUrl: null,
  role: 'user' as const,
};
const dave = {
  id: 'user-dave',
  slug: 'dave',
  displayName: 'Dave',
  publicName: null,
  discordHandle: null,
  avatarUrl: null,
  role: 'user' as const,
};
const eve = {
  id: 'user-eve',
  slug: 'eve',
  displayName: 'Eve',
  publicName: null,
  discordHandle: null,
  avatarUrl: null,
  role: 'user' as const,
};
const frank = {
  id: 'user-frank',
  slug: 'frank',
  displayName: 'Frank',
  publicName: null,
  discordHandle: null,
  avatarUrl: null,
  role: 'user' as const,
};

function publicUser(user: {
  id: string;
  displayName: string;
  slug: string;
  publicName?: string | null;
  discordHandle?: string | null;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    displayName: user.displayName,
    publicName: user.publicName ?? null,
    discordHandle: user.discordHandle ?? null,
    slug: user.slug,
    avatarUrl: user.avatarUrl ?? null,
  };
}

const week1 = { id: 'week-1', name: 'Week 1', status: 'completed' as const, orderIndex: 1 };
const week2 = { id: 'week-2', name: 'Week 2', status: 'active' as const, orderIndex: 2 };
const weekSetup = { id: 'week-setup', name: 'Week Setup', status: 'setup' as const, orderIndex: 2 };
const w2r1 = { id: 'w2-r1', roundNumber: 1, status: 'completed' as const };
const w2r2 = { id: 'w2-r2', roundNumber: 2, status: 'in_progress' as const };
const w2r2NotStarted = { id: 'w2-r2-ns', roundNumber: 2, status: 'not_started' as const };

function membership(user: ReturnType<typeof publicUser> extends infer T ? T : never) {
  return { userId: user.id, user };
}

function makeDeck(
  id: string,
  owner: { id: string },
  event: typeof week1,
  round: typeof w2r1,
  status: 'draft' | 'submitted' | 'locked',
  orderIndex: number,
) {
  return {
    id,
    userId: owner.id,
    status,
    orderIndex,
    name: id,
    user: publicUser(
      owner.id === alice.id
        ? alice
        : owner.id === bob.id
          ? bob
          : owner.id === carol.id
            ? carol
            : owner.id === dave.id
              ? dave
              : owner.id === eve.id
                ? eve
                : frank,
    ),
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      orderIndex: event.orderIndex,
    },
    round: {
      id: round.id,
      roundNumber: round.roundNumber,
      status: round.status,
    },
    entries: [],
  };
}

const happyDecks = [
  makeDeck('alice-official', alice, week2, w2r2, 'submitted', 0),
  makeDeck('alice-draft-slot1', alice, week2, w2r2, 'draft', 1),
  makeDeck('bob-locked-0', bob, week2, w2r2, 'locked', 0),
  makeDeck('bob-sub-1', bob, week2, w2r2, 'submitted', 1),
  makeDeck('carol-draft-0', carol, week2, w2r2, 'draft', 0),
  makeDeck('carol-extra', carol, week2, w2r2, 'draft', 2),
  makeDeck('dave-extra-sub', dave, week2, w2r2, 'submitted', 2),
];

function happySeason(events: unknown[]) {
  return {
    id: 'season-1',
    name: 'Season 1',
    leagueId: 'league-1',
    decklistVisibility: false,
    events,
  };
}

function week2Event(rounds: Array<{ id: string; roundNumber: number; status: string }>, extra?: { status?: string; config?: unknown }) {
  return {
    id: week2.id,
    name: week2.name,
    status: extra?.status ?? week2.status,
    orderIndex: week2.orderIndex,
    config: extra?.config === undefined ? { deckCount: 2, format: 'swiss' } : extra.config,
    rounds,
  };
}

function mockHappyPath(options?: {
  events?: unknown[];
  memberships?: Array<{ userId: string; user: ReturnType<typeof publicUser> }>;
  drops?: Array<{ userId: string; eventId: string | null }>;
  decks?: unknown[];
}) {
  const events = options?.events ?? [
    {
      id: week1.id,
      name: week1.name,
      status: week1.status,
      orderIndex: week1.orderIndex,
      config: { deckCount: 2, format: 'swiss' },
      rounds: [{ id: 'w1-r1', roundNumber: 1, status: 'completed' }],
    },
    week2Event([w2r1, w2r2]),
  ];
  prismaMock.season.findUnique.mockResolvedValue(happySeason(events));
  prismaMock.season.findFirst.mockResolvedValue(happySeason(events));
  prismaMock.leagueMembership.findMany.mockResolvedValue(
    options?.memberships ?? [
      membership(publicUser(alice)),
      membership(publicUser(bob)),
      membership(publicUser(carol)),
      membership(publicUser(dave)),
      membership(publicUser(eve)),
    ],
  );
  prismaMock.playerDrop.findMany.mockResolvedValue(options?.drops ?? []);
  prismaMock.decklist.findMany.mockResolvedValue(options?.decks ?? happyDecks);
}

describe('getAdminDeckChecks', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('returns no_active_season when omit seasonId and findFirst is null', async () => {
    prismaMock.season.findFirst.mockResolvedValue(null);

    const result = await getAdminDeckChecks();

    expect(result).toEqual({
      emptyReason: 'no_active_season',
      season: null,
      event: null,
      round: null,
      deckCount: null,
      decklists: [],
      players: [],
    });
    expect(prismaMock.decklist.findMany).not.toHaveBeenCalled();
    expect(prismaMock.leagueMembership.findMany).not.toHaveBeenCalled();
    expect(prismaMock.playerDrop.findMany).not.toHaveBeenCalled();
    expect(prismaMock.round.create).not.toHaveBeenCalled();
    expect(prismaMock.decklist.update).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when seasonId is unknown', async () => {
    prismaMock.season.findUnique.mockResolvedValue(null);

    await expect(getAdminDeckChecks('season-missing')).rejects.toEqual(
      expect.objectContaining({
        statusCode: 404,
        code: 'NOT_FOUND',
      }),
    );
    expect(prismaMock.round.create).not.toHaveBeenCalled();
    expect(prismaMock.decklist.update).not.toHaveBeenCalled();
  });

  it('returns no_current_event when only completed events exist', async () => {
    prismaMock.season.findUnique.mockResolvedValue(
      happySeason([
        {
          id: week1.id,
          name: week1.name,
          status: 'completed',
          orderIndex: 1,
          config: { deckCount: 2, format: 'swiss' },
          rounds: [{ id: 'w1-r1', roundNumber: 1, status: 'completed' }],
        },
      ]),
    );

    const result = await getAdminDeckChecks('season-1');

    expect(result.emptyReason).toBe('no_current_event');
    expect(result.season).toEqual({
      id: 'season-1',
      name: 'Season 1',
      decklistVisibility: false,
    });
    expect(result.event).toBeNull();
    expect(result.round).toBeNull();
    expect(result.deckCount).toBeNull();
    expect(result.decklists).toEqual([]);
    expect(result.players).toEqual([]);
    expect(prismaMock.round.create).not.toHaveBeenCalled();
  });

  it('picks the active event over a setup event', async () => {
    mockHappyPath({
      events: [
        {
          id: weekSetup.id,
          name: weekSetup.name,
          status: 'setup',
          orderIndex: 1,
          config: { deckCount: 2, format: 'swiss' },
          rounds: [w2r1, w2r2],
        },
        week2Event([w2r1, w2r2]),
      ],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.event?.id).toBe('week-2');
  });

  it('picks setup when there is no active event', async () => {
    mockHappyPath({
      events: [
        {
          id: week1.id,
          name: week1.name,
          status: 'completed',
          orderIndex: 1,
          config: { deckCount: 2, format: 'swiss' },
          rounds: [{ id: 'w1-r1', roundNumber: 1, status: 'completed' }],
        },
        {
          id: weekSetup.id,
          name: weekSetup.name,
          status: 'setup',
          orderIndex: 2,
          config: { deckCount: 2, format: 'swiss' },
          rounds: [w2r1, w2r2],
        },
      ],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.event?.id).toBe('week-setup');
  });

  it('returns no_current_round without creating a round when the event has none', async () => {
    mockHappyPath({
      events: [week2Event([], { config: { deckCount: 2, format: 'swiss' } })],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.emptyReason).toBe('no_current_round');
    expect(result.event?.id).toBe('week-2');
    expect(result.round).toBeNull();
    expect(result.deckCount).toBe(2);
    expect(result.decklists).toEqual([]);
    expect(result.players).toEqual([]);
    expect(prismaMock.round.create).not.toHaveBeenCalled();
    expect(prismaMock.leagueMembership.findMany).not.toHaveBeenCalled();
    expect(prismaMock.decklist.findMany).not.toHaveBeenCalled();
  });

  it('picks in_progress over not_started', async () => {
    mockHappyPath({
      events: [week2Event([w2r2NotStarted, w2r2])],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.round?.id).toBe('w2-r2');
  });

  it('returns the last completed round when the event is still active', async () => {
    mockHappyPath({
      events: [
        week2Event([
          { id: 'w2-r1', roundNumber: 1, status: 'completed' },
          { id: 'w2-r2', roundNumber: 2, status: 'completed' },
        ]),
      ],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.emptyReason).toBeNull();
    expect(result.round).toEqual({
      id: 'w2-r2',
      roundNumber: 2,
      status: 'completed',
    });
  });

  it('returns official lists and roster when decklistVisibility is false', async () => {
    mockHappyPath();

    const result = await getAdminDeckChecks('season-1');

    expect(prismaMock.season.findUnique).toHaveBeenCalled();
    expect(prismaMock.season.findFirst).not.toHaveBeenCalled();
    expect(result.emptyReason).toBeNull();
    expect(result.season).toEqual({
      id: 'season-1',
      name: 'Season 1',
      decklistVisibility: false,
    });
    expect(result.deckCount).toBe(2);
    expect(result.decklists.map((deck) => deck.id).sort()).toEqual(
      ['alice-official', 'bob-locked-0', 'bob-sub-1', 'dave-extra-sub'].sort(),
    );
    expect(result.decklists.every((deck) => deck.status === 'submitted' || deck.status === 'locked')).toBe(true);
    expect(result.decklists.map((deck) => deck.id)).not.toContain('carol-draft-0');
    expect(result.decklists.map((deck) => deck.id)).not.toContain('carol-extra');
    expect(result.players.map((player) => player.user.id)).toEqual([
      'user-alice',
      'user-bob',
      'user-carol',
      'user-dave',
      'user-eve',
    ]);
    expect(result.players.map((player) => player.registeredCount)).toEqual([1, 2, 0, 1, 0]);
    expect(result.players.every((player) => player.requiredCount === 2)).toBe(true);
    expect(prismaMock.decklist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'week-2' },
      }),
    );
    expect(prismaMock.decklist.findMany.mock.calls[0][0].where.roundId).toBeUndefined();
    expect(prismaMock.round.create).not.toHaveBeenCalled();
    expect(prismaMock.decklist.update).not.toHaveBeenCalled();
  });

  it('returns origin-round registered lists while round 2 is in_progress', async () => {
    mockHappyPath({
      events: [week2Event([w2r1, w2r2])],
      decks: [
        makeDeck('alice-req-0', alice, week2, w2r1, 'submitted', 0),
        makeDeck('alice-draft-1', alice, week2, w2r1, 'draft', 1),
        makeDeck('alice-extra-2', alice, week2, w2r1, 'draft', 2),
        makeDeck('bob-r2-draft', bob, week2, w2r2, 'draft', 0),
      ],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.round?.id).toBe('w2-r2');
    expect(result.decklists.map((deck) => deck.id)).toEqual(['alice-req-0']);
    expect(result.decklists.every((deck) => deck.status === 'submitted' || deck.status === 'locked')).toBe(true);
    expect(prismaMock.decklist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'week-2' },
      }),
    );
    expect(prismaMock.decklist.findMany.mock.calls[0][0].where.roundId).toBeUndefined();
  });

  it('omits a player dropped from the event', async () => {
    mockHappyPath({
      memberships: [
        membership(publicUser(alice)),
        membership(publicUser(bob)),
        membership(publicUser(carol)),
        membership(publicUser(dave)),
        membership(publicUser(eve)),
        membership(publicUser(frank)),
      ],
      drops: [{ userId: frank.id, eventId: 'week-2' }],
      decks: [...happyDecks, makeDeck('frank-official', frank, week2, w2r2, 'submitted', 0)],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.players.map((player) => player.user.id)).toEqual([
      'user-alice',
      'user-bob',
      'user-carol',
      'user-dave',
      'user-eve',
    ]);
    expect(result.decklists.map((deck) => deck.id).sort()).toEqual(
      ['alice-official', 'bob-locked-0', 'bob-sub-1', 'dave-extra-sub'].sort(),
    );
  });

  it('omits a player dropped from the season', async () => {
    mockHappyPath({
      memberships: [
        membership(publicUser(alice)),
        membership(publicUser(bob)),
        membership(publicUser(carol)),
        membership(publicUser(dave)),
        membership(publicUser(eve)),
        membership(publicUser(frank)),
      ],
      drops: [{ userId: frank.id, eventId: null }],
      decks: [...happyDecks, makeDeck('frank-official', frank, week2, w2r2, 'submitted', 0)],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.players.map((player) => player.user.id)).not.toContain('user-frank');
    expect(result.decklists.map((deck) => deck.id)).not.toContain('frank-official');
  });

  it('does not include a non-member admin in the roster', async () => {
    mockHappyPath();

    const result = await getAdminDeckChecks('season-1');

    expect(result.players.map((player) => player.user.id)).not.toContain('user-admin');
  });

  it('defaults deckCount to 1 when config is missing', async () => {
    mockHappyPath({
      events: [week2Event([w2r1, w2r2], { config: null })],
      decks: [
        makeDeck('alice-official', alice, week2, w2r2, 'submitted', 0),
        makeDeck('alice-slot1', alice, week2, w2r2, 'submitted', 1),
      ],
    });

    const result = await getAdminDeckChecks('season-1');

    expect(result.deckCount).toBe(1);
    expect(result.decklists.map((deck) => deck.id)).toEqual(['alice-official', 'alice-slot1']);
    expect(result.players.find((player) => player.user.id === 'user-alice')?.registeredCount).toBe(2);
  });
});
