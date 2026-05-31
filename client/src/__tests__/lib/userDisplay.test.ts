import { describe, expect, it } from 'vitest';
import { discordHandleRaw, discordHandleText, primaryName, profileSubtitle } from '../../lib/userDisplay';

describe('userDisplay', () => {
  describe('discordHandleRaw', () => {
    it('returns null when handle is missing or blank', () => {
      expect(discordHandleRaw({ displayName: 'Alice', discordHandle: null })).toBeNull();
      expect(discordHandleRaw({ displayName: 'Bob', discordHandle: '  ' })).toBeNull();
    });

    it('returns trimmed handle when set', () => {
      expect(discordHandleRaw({ displayName: 'Alice', discordHandle: 'alice_d' })).toBe('alice_d');
    });
  });

  describe('discordHandleText', () => {
    it('returns null when handle is missing or blank', () => {
      expect(discordHandleText({ displayName: 'Alice', discordHandle: null })).toBeNull();
      expect(discordHandleText({ displayName: 'Bob', discordHandle: '  ' })).toBeNull();
    });

    it('returns handle when distinct from displayName', () => {
      expect(discordHandleText({ displayName: 'Alice', discordHandle: 'alice_d' })).toBe('alice_d');
    });

    it('returns handle even when it matches displayName', () => {
      expect(discordHandleText({ displayName: 'Alice', discordHandle: 'alice' })).toBe('alice');
    });
  });

  describe('profileSubtitle', () => {
    it('shows account name when public alias is set', () => {
      expect(
        profileSubtitle({ displayName: 'ninjapuff', publicName: 'Scott', discordHandle: 'ninjapuff' }),
      ).toBe('ninjapuff');
    });

    it('shows discord handle when no public alias is set', () => {
      expect(
        profileSubtitle({ displayName: 'Scott Harris', publicName: null, discordHandle: 'scott_discord' }),
      ).toBe('scott_discord');
    });

    it('returns null when neither applies', () => {
      expect(profileSubtitle({ displayName: 'Bob', publicName: null, discordHandle: null })).toBeNull();
    });

    it('returns null when handle matches display name without a public alias', () => {
      expect(profileSubtitle({ displayName: 'same', publicName: null, discordHandle: 'same' })).toBeNull();
    });
  });

  describe('primaryName', () => {
    it('prefers publicName when set', () => {
      expect(primaryName({ displayName: 'Alice', publicName: 'Alias' })).toBe('Alias');
    });
  });
});
