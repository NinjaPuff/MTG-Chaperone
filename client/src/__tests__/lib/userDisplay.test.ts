import { describe, expect, it } from 'vitest';
import { discordHandleRaw, discordHandleText, primaryName } from '../../lib/userDisplay';

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

    it('suppresses duplicate handle matching displayName case-insensitively', () => {
      expect(discordHandleText({ displayName: 'Alice', discordHandle: 'alice' })).toBeNull();
      expect(discordHandleRaw({ displayName: 'Alice', discordHandle: 'alice' })).toBe('alice');
    });
  });

  describe('primaryName', () => {
    it('prefers publicName when set', () => {
      expect(primaryName({ displayName: 'Alice', publicName: 'Alias' })).toBe('Alias');
    });
  });
});
