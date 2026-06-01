import { describe, expect, it } from 'vitest';
import {
  canViewDecklist,
  canViewFullSchedule,
  canViewPool,
  canViewSeasonDecklists,
  canViewSeasonPools,
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
const admin = { id: 'user-admin', role: 'admin' as const };

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
});
