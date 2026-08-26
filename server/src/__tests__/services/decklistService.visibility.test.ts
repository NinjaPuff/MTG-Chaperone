import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { spectatorFixtures } from '../helpers/spectatorFixtures.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import {
  getDecklistById,
  listVisibleDecklistsForEvent,
  listVisibleDecklistsForSeason,
} from '../../services/decklistService.js';

const alice = spectatorFixtures.users.alice;
const bob = spectatorFixtures.users.bob;
const admin = spectatorFixtures.users.admin;
const charlie = { id: 'user-charlie', role: 'user' as const };
const carol = {
  id: 'user-carol',
  slug: 'carol',
  displayName: 'Carol',
  publicName: null,
  discordHandle: null,
  avatarUrl: null,
  role: 'user' as const,
};

const visibleSeason = spectatorFixtures.seasons.visible;
const hiddenSeason = spectatorFixtures.seasons.hidden;

const week1 = { id: 'week-1', name: 'Week 1', status: 'completed' as const, orderIndex: 1 };
const week2 = { id: 'week-2', name: 'Week 2', status: 'active' as const, orderIndex: 2 };
const w1r1 = { id: 'w1-r1', roundNumber: 1, status: 'completed' as const };
const w2r1 = { id: 'w2-r1', roundNumber: 1, status: 'completed' as const };
const w2r2 = { id: 'w2-r2', roundNumber: 2, status: 'in_progress' as const };

function publicUser(user: { id: string; displayName: string; slug: string; publicName?: string | null; discordHandle?: string | null; avatarUrl?: string | null }) {
  return {
    id: user.id,
    displayName: user.displayName,
    publicName: user.publicName ?? null,
    discordHandle: user.discordHandle ?? null,
    slug: user.slug,
    avatarUrl: user.avatarUrl ?? null,
  };
}

function makeDeck(id: string, owner: typeof alice | typeof bob | typeof carol, event: typeof week1, round: typeof w1r1, status: 'draft' | 'submitted' | 'locked', orderIndex: number) {
  return {
    id,
    userId: owner.id,
    status,
    orderIndex,
    name: id,
    user: publicUser(owner),
    event,
    round,
    entries: [],
  };
}

const fixtures = {
  'alice-w1-reg': makeDeck('alice-w1-reg', alice, week1, w1r1, 'submitted', 0),
  'bob-w1-locked': makeDeck('bob-w1-locked', bob, week1, w1r1, 'locked', 0),
  'bob-w1-draft': makeDeck('bob-w1-draft', bob, week1, w1r1, 'draft', 1),
  'carol-w1-draft': makeDeck('carol-w1-draft', carol, week1, w1r1, 'draft', 0),
  'alice-w2-r1': makeDeck('alice-w2-r1', alice, week2, w2r1, 'submitted', 0),
  'bob-w2-r2-draft': makeDeck('bob-w2-r2-draft', bob, week2, w2r2, 'draft', 0),
  'bob-w2-r2-sub': makeDeck('bob-w2-r2-sub', bob, week2, w2r2, 'submitted', 0),
  'alice-current-draft': makeDeck('alice-current-draft', alice, week2, w2r2, 'draft', 0),
};

const allFixtures = Object.values(fixtures);

function idsOf(decks: Array<{ id: string }>) {
  return decks.map((deck) => deck.id).sort();
}

function mockUserPool() {
  prismaMock.cardPool.findUnique.mockResolvedValue({
    id: 'pool-1',
    acquisitions: [],
  });
  prismaMock.cachedCard.findMany.mockResolvedValue([]);
}

function asGetPayload(deck: (typeof allFixtures)[number], season: typeof visibleSeason) {
  return {
    ...deck,
    event: {
      ...deck.event,
      config: {},
      season: {
        id: season.id,
        poolVisibility: season.poolVisibility,
        decklistVisibility: season.decklistVisibility,
        scheduleVisibility: season.scheduleVisibility,
      },
    },
  };
}

describe('decklistService visibility', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  describe('listVisibleDecklistsForSeason', () => {
    it('returns registered decks only for Charlie and omits leftover archive drafts', async () => {
      prismaMock.season.findUnique.mockResolvedValue(visibleSeason);
      prismaMock.decklist.findMany.mockResolvedValue(allFixtures);

      const result = await listVisibleDecklistsForSeason('season-1', charlie);

      expect(idsOf(result)).toEqual(
        ['alice-w1-reg', 'alice-w2-r1', 'bob-w1-locked', 'bob-w2-r2-sub'].sort(),
      );
    });

    it('returns the same registered-only list for anonymous viewers', async () => {
      prismaMock.season.findUnique.mockResolvedValue(visibleSeason);
      prismaMock.decklist.findMany.mockResolvedValue(allFixtures);

      const result = await listVisibleDecklistsForSeason('season-1', null);

      expect(idsOf(result)).toEqual(
        ['alice-w1-reg', 'alice-w2-r1', 'bob-w1-locked', 'bob-w2-r2-sub'].sort(),
      );
    });

    it('includes Alice current-round draft for Alice and still omits Bob current-round draft', async () => {
      prismaMock.season.findUnique.mockResolvedValue(visibleSeason);
      prismaMock.decklist.findMany.mockResolvedValue(allFixtures);

      const result = await listVisibleDecklistsForSeason('season-1', alice);

      expect(idsOf(result)).toEqual(
        [
          'alice-w1-reg',
          'alice-w2-r1',
          'alice-current-draft',
          'bob-w1-locked',
          'bob-w2-r2-sub',
        ].sort(),
      );
    });

    it('returns every fixture for a site admin', async () => {
      prismaMock.season.findUnique.mockResolvedValue(visibleSeason);
      prismaMock.decklist.findMany.mockResolvedValue(allFixtures);

      const result = await listVisibleDecklistsForSeason('season-1', admin);

      expect(idsOf(result)).toEqual(idsOf(allFixtures));
    });

    it('returns no decks for Charlie on a hidden season', async () => {
      prismaMock.season.findUnique.mockResolvedValue(hiddenSeason);
      prismaMock.decklist.findMany.mockResolvedValue(allFixtures);

      const result = await listVisibleDecklistsForSeason('season-hidden', charlie);

      expect(result).toEqual([]);
    });

    it('returns only Alice-owned decks for Alice on a hidden season', async () => {
      prismaMock.season.findUnique.mockResolvedValue(hiddenSeason);
      prismaMock.decklist.findMany.mockResolvedValue(allFixtures);

      const result = await listVisibleDecklistsForSeason('season-hidden', alice);

      expect(idsOf(result)).toEqual(['alice-current-draft', 'alice-w1-reg', 'alice-w2-r1'].sort());
    });

    it('throws NOT_FOUND for an unknown season', async () => {
      prismaMock.season.findUnique.mockResolvedValue(null);

      await expect(listVisibleDecklistsForSeason('missing', charlie)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
      expect(prismaMock.decklist.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getDecklistById', () => {
    beforeEach(() => {
      mockUserPool();
    });

    it('forbids Charlie from opening leftover archive drafts', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(asGetPayload(fixtures['bob-w1-draft'], visibleSeason));

      await expect(getDecklistById('bob-w1-draft', charlie)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
      expect(prismaMock.decklist.update).not.toHaveBeenCalled();
    });

    it('forbids Charlie from opening Carol leftover archive draft', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(asGetPayload(fixtures['carol-w1-draft'], visibleSeason));

      await expect(getDecklistById('carol-w1-draft', charlie)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
      expect(prismaMock.decklist.update).not.toHaveBeenCalled();
    });

    it('forbids Charlie from opening Alice current-round draft', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(asGetPayload(fixtures['alice-current-draft'], visibleSeason));

      await expect(getDecklistById('alice-current-draft', charlie)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('forbids Charlie from opening Bob current-round draft', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(asGetPayload(fixtures['bob-w2-r2-draft'], visibleSeason));

      await expect(getDecklistById('bob-w2-r2-draft', charlie)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('allows Charlie to open Bob current-round submitted deck', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(asGetPayload(fixtures['bob-w2-r2-sub'], visibleSeason));

      const result = await getDecklistById('bob-w2-r2-sub', charlie);

      expect(result.id).toBe('bob-w2-r2-sub');
    });

    it('forbids Charlie from opening a leftover draft on a hidden season', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(asGetPayload(fixtures['bob-w1-draft'], hiddenSeason));

      await expect(getDecklistById('bob-w1-draft', charlie)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('allows Alice to open her current-round draft', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(asGetPayload(fixtures['alice-current-draft'], visibleSeason));

      const result = await getDecklistById('alice-current-draft', alice);

      expect(result.id).toBe('alice-current-draft');
    });

    it('allows Alice to open her leftover archive draft after the round completes', async () => {
      const completedDraft = {
        ...asGetPayload(fixtures['alice-current-draft'], visibleSeason),
        event: {
          ...asGetPayload(fixtures['alice-current-draft'], visibleSeason).event,
          status: 'completed' as const,
        },
        round: { ...fixtures['alice-current-draft'].round, status: 'completed' as const },
      };
      prismaMock.decklist.findUnique.mockResolvedValue(completedDraft);

      const result = await getDecklistById('alice-current-draft', alice);

      expect(result.id).toBe('alice-current-draft');
    });

    it('forbids Charlie from opening Bob leftover draft after the round completes', async () => {
      const completedDraft = {
        ...asGetPayload(fixtures['bob-w2-r2-draft'], visibleSeason),
        event: {
          ...asGetPayload(fixtures['bob-w2-r2-draft'], visibleSeason).event,
          status: 'completed' as const,
        },
        round: { ...fixtures['bob-w2-r2-draft'].round, status: 'completed' as const },
      };
      prismaMock.decklist.findUnique.mockResolvedValue(completedDraft);

      await expect(getDecklistById('bob-w2-r2-draft', charlie)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('throws NOT_FOUND for a missing decklist', async () => {
      prismaMock.decklist.findUnique.mockResolvedValue(null);

      await expect(getDecklistById('missing', charlie)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('listVisibleDecklistsForEvent', () => {
    it('returns week-2 decks Charlie may see and omits Bob current-round draft', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        id: 'week-2',
        season: visibleSeason,
      });
      prismaMock.decklist.findMany.mockResolvedValue(
        allFixtures.filter((deck) => deck.event.id === 'week-2'),
      );

      const result = await listVisibleDecklistsForEvent('week-2', charlie);

      expect(idsOf(result)).toEqual(['alice-w2-r1', 'bob-w2-r2-sub'].sort());
    });

    it('returns week-1 registered decks for Charlie and omits leftover drafts', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        id: 'week-1',
        season: visibleSeason,
      });
      prismaMock.decklist.findMany.mockResolvedValue(
        allFixtures.filter((deck) => deck.event.id === 'week-1'),
      );

      const result = await listVisibleDecklistsForEvent('week-1', charlie);

      expect(idsOf(result)).toEqual(['alice-w1-reg', 'bob-w1-locked'].sort());
    });

    it('throws NOT_FOUND for a missing event', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(listVisibleDecklistsForEvent('missing', charlie)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
      expect(prismaMock.decklist.findMany).not.toHaveBeenCalled();
    });
  });
});
