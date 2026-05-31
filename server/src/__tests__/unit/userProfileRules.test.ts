import { describe, expect, it } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
import { formatProfileResponse, resolveAuthProvider, validateDiscordHandle } from '../../lib/userProfileRules.js';

function getAppError(fn: () => void) {
  try {
    fn();
    throw new Error('Expected AppError to be thrown');
  } catch (error) {
    if (!(error instanceof AppError)) {
      throw error;
    }
    return error;
  }
}

describe('resolveAuthProvider', () => {
  it('returns discord when discordId is set', () => {
    expect(resolveAuthProvider({ discordId: 'd1', googleId: null })).toBe('discord');
  });

  it('returns google when only googleId is set', () => {
    expect(resolveAuthProvider({ discordId: null, googleId: 'g1' })).toBe('google');
  });
});

describe('formatProfileResponse', () => {
  it('strips oauth ids and adds authProvider', () => {
    expect(
      formatProfileResponse({
        id: 'u1',
        displayName: 'User',
        discordId: null,
        googleId: 'g1',
      }),
    ).toEqual({
      id: 'u1',
      displayName: 'User',
      authProvider: 'google',
    });
  });
});

describe('validateDiscordHandle', () => {
  it('returns null for null, empty string, and whitespace-only input', () => {
    expect(validateDiscordHandle(null)).toBeNull();
    expect(validateDiscordHandle('')).toBeNull();
    expect(validateDiscordHandle('   ')).toBeNull();
  });

  it('accepts valid handles and trims whitespace', () => {
    expect(validateDiscordHandle('Player_One')).toBe('Player_One');
    expect(validateDiscordHandle('abc123')).toBe('abc123');
    expect(validateDiscordHandle('  trimmed  ')).toBe('trimmed');
  });

  it('accepts a 32-character handle at the boundary', () => {
    const handle = 'a'.repeat(32);
    expect(validateDiscordHandle(handle)).toBe(handle);
  });

  it('rejects handles longer than 32 characters', () => {
    const error = getAppError(() => validateDiscordHandle('a'.repeat(33)));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fields?.discordHandle).toBeDefined();
  });

  it('rejects handles with invalid characters', () => {
    for (const handle of ['bad handle', 'user#123', 'name!']) {
      const error = getAppError(() => validateDiscordHandle(handle));
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fields?.discordHandle).toBeDefined();
    }
  });
});
