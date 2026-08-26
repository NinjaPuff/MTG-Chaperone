import { describe, expect, it } from 'vitest';
import {
  canViewDecklist,
  canViewFullSchedule,
  canViewPool,
  canViewSeasonDecklists,
  canViewSeasonPools,
  isArchiveRound,
  isDecklistVisibleToViewer,
  isPublicDecklistStatus,
} from '../../lib/visibilityRules.js';

const visibleSeason = {
  poolVisibility: true,
  decklistVisibility: true,
  scheduleVisibility: true,
};

const hiddenSeason = {
  poolVisibility: false,
  decklistVisibility: false,
  scheduleVisibility: false,
};

const alice = { id: 'user-alice', role: 'user' as const };
const bob = { id: 'user-bob', role: 'user' as const };
const charlie = { id: 'user-charlie', role: 'user' as const };
const admin = { id: 'user-admin', role: 'admin' as const };

const leftoverDraft = {
  userId: bob.id,
  status: 'draft' as const,
  eventStatus: 'completed' as const,
  roundStatus: 'completed' as const,
};

const currentForeignDraft = {
  userId: bob.id,
  status: 'draft' as const,
  eventStatus: 'active' as const,
  roundStatus: 'in_progress' as const,
};

const aliceCurrentDraft = {
  userId: alice.id,
  status: 'draft' as const,
  eventStatus: 'active' as const,
  roundStatus: 'in_progress' as const,
};

describe('visibilityRules', () => {
  describe('canViewSeasonPools', () => {
    it('allows anonymous viewers when pool visibility is on', () => {
      expect(canViewSeasonPools(visibleSeason)).toBe(true);
    });

    it('denies anonymous viewers when pool visibility is off', () => {
      expect(canViewSeasonPools(hiddenSeason)).toBe(false);
    });

    it('allows owner when pool visibility is off', () => {
      expect(canViewSeasonPools(hiddenSeason, alice, alice.id)).toBe(true);
    });

    it('denies other users when pool visibility is off', () => {
      expect(canViewSeasonPools(hiddenSeason, bob, alice.id)).toBe(false);
    });

    it('allows site admin regardless of visibility', () => {
      expect(canViewSeasonPools(hiddenSeason, admin)).toBe(true);
    });
  });

  describe('canViewPool', () => {
    it('allows anonymous viewers when pool visibility is on', () => {
      expect(canViewPool({ userId: alice.id }, visibleSeason)).toBe(true);
    });

    it('denies anonymous viewers when pool visibility is off', () => {
      expect(canViewPool({ userId: alice.id }, hiddenSeason)).toBe(false);
    });

    it('allows owner when pool visibility is off', () => {
      expect(canViewPool({ userId: alice.id }, hiddenSeason, alice)).toBe(true);
    });

    it('denies other users when pool visibility is off', () => {
      expect(canViewPool({ userId: alice.id }, hiddenSeason, bob)).toBe(false);
    });

    it('allows site admin regardless of visibility', () => {
      expect(canViewPool({ userId: alice.id }, hiddenSeason, admin)).toBe(true);
    });
  });

  describe('canViewSeasonDecklists', () => {
    it('allows anonymous viewers when decklist visibility is on', () => {
      expect(canViewSeasonDecklists(visibleSeason)).toBe(true);
    });

    it('denies anonymous viewers when decklist visibility is off', () => {
      expect(canViewSeasonDecklists(hiddenSeason)).toBe(false);
    });

    it('allows owner when decklist visibility is off', () => {
      expect(canViewSeasonDecklists(hiddenSeason, alice, alice.id)).toBe(true);
    });

    it('denies other users when decklist visibility is off', () => {
      expect(canViewSeasonDecklists(hiddenSeason, bob, alice.id)).toBe(false);
    });

    it('allows site admin regardless of visibility', () => {
      expect(canViewSeasonDecklists(hiddenSeason, admin)).toBe(true);
    });
  });

  describe('canViewDecklist', () => {
    it('allows anonymous viewers when decklist visibility is on', () => {
      expect(canViewDecklist({ userId: alice.id }, visibleSeason)).toBe(true);
    });

    it('denies anonymous viewers when decklist visibility is off', () => {
      expect(canViewDecklist({ userId: alice.id }, hiddenSeason)).toBe(false);
    });

    it('allows owner when decklist visibility is off', () => {
      expect(canViewDecklist({ userId: alice.id }, hiddenSeason, alice)).toBe(true);
    });

    it('denies other users when decklist visibility is off', () => {
      expect(canViewDecklist({ userId: alice.id }, hiddenSeason, bob)).toBe(false);
    });
  });

  describe('canViewFullSchedule', () => {
    it('allows anonymous viewers when schedule visibility is on', () => {
      expect(canViewFullSchedule(visibleSeason)).toBe(true);
    });

    it('denies anonymous viewers when schedule visibility is off', () => {
      expect(canViewFullSchedule(hiddenSeason)).toBe(false);
    });

    it('allows site admin regardless of visibility', () => {
      expect(canViewFullSchedule(hiddenSeason, admin)).toBe(true);
    });
  });

  describe('isPublicDecklistStatus', () => {
    it('treats submitted and locked as public', () => {
      expect(isPublicDecklistStatus('submitted')).toBe(true);
      expect(isPublicDecklistStatus('locked')).toBe(true);
    });

    it('treats draft as not public', () => {
      expect(isPublicDecklistStatus('draft')).toBe(false);
    });
  });

  describe('isArchiveRound', () => {
    it('is true when the round is completed', () => {
      expect(isArchiveRound({ status: 'active' }, { status: 'completed' })).toBe(true);
    });

    it('is true when the event is completed even if the round is still in progress', () => {
      expect(isArchiveRound({ status: 'completed' }, { status: 'in_progress' })).toBe(true);
    });

    it('is true when the event is completed even if the round is not started', () => {
      expect(isArchiveRound({ status: 'completed' }, { status: 'not_started' })).toBe(true);
    });

    it('is false for an active event with an in-progress round', () => {
      expect(isArchiveRound({ status: 'active' }, { status: 'in_progress' })).toBe(false);
    });

    it('is false for an active event with a not-started round', () => {
      expect(isArchiveRound({ status: 'active' }, { status: 'not_started' })).toBe(false);
    });

    it('is false for a setup event with a not-started round', () => {
      expect(isArchiveRound({ status: 'setup' }, { status: 'not_started' })).toBe(false);
    });
  });

  describe('isDecklistVisibleToViewer', () => {
    it('allows Charlie to see submitted and locked decks on a visible season regardless of round', () => {
      expect(
        isDecklistVisibleToViewer(
          { userId: alice.id, status: 'submitted' },
          visibleSeason,
          charlie,
        ),
      ).toBe(true);
      expect(
        isDecklistVisibleToViewer(
          { userId: alice.id, status: 'locked' },
          visibleSeason,
          charlie,
        ),
      ).toBe(true);
    });

    it('hides leftover drafts from Charlie even on an archive round of a visible season', () => {
      expect(
        isDecklistVisibleToViewer(
          { userId: leftoverDraft.userId, status: leftoverDraft.status },
          visibleSeason,
          charlie,
        ),
      ).toBe(false);
    });

    it('hides Bob current-round draft from Charlie on a visible season', () => {
      expect(
        isDecklistVisibleToViewer(
          { userId: currentForeignDraft.userId, status: currentForeignDraft.status },
          visibleSeason,
          charlie,
        ),
      ).toBe(false);
    });

    it('hides registered and leftover decks from Charlie on a hidden season', () => {
      expect(
        isDecklistVisibleToViewer(
          { userId: alice.id, status: 'submitted' },
          hiddenSeason,
          charlie,
        ),
      ).toBe(false);
      expect(
        isDecklistVisibleToViewer(
          { userId: leftoverDraft.userId, status: leftoverDraft.status },
          hiddenSeason,
          charlie,
        ),
      ).toBe(false);
      expect(
        isDecklistVisibleToViewer(
          { userId: currentForeignDraft.userId, status: currentForeignDraft.status },
          hiddenSeason,
          charlie,
        ),
      ).toBe(false);
    });

    it('allows Alice to see her own current-round draft on a hidden season', () => {
      expect(
        isDecklistVisibleToViewer(
          { userId: aliceCurrentDraft.userId, status: aliceCurrentDraft.status },
          hiddenSeason,
          alice,
        ),
      ).toBe(true);
    });

    it('allows admin to see Bob current-round draft on a hidden season', () => {
      expect(
        isDecklistVisibleToViewer(
          { userId: currentForeignDraft.userId, status: currentForeignDraft.status },
          hiddenSeason,
          admin,
        ),
      ).toBe(true);
    });

    it('hides leftover archive drafts and current-round foreign drafts from anonymous viewers', () => {
      expect(
        isDecklistVisibleToViewer(
          { userId: leftoverDraft.userId, status: leftoverDraft.status },
          visibleSeason,
          null,
        ),
      ).toBe(false);
      expect(
        isDecklistVisibleToViewer(
          { userId: currentForeignDraft.userId, status: currentForeignDraft.status },
          visibleSeason,
          null,
        ),
      ).toBe(false);
    });
  });
});
