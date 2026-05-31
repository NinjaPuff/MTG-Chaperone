import { AppError } from '../middleware/errorHandler.js';

const DISCORD_HANDLE_PATTERN = /^[a-zA-Z0-9_.]+$/;
const DISCORD_HANDLE_MAX_LENGTH = 32;

export type AuthProvider = 'discord' | 'google';

export function resolveAuthProvider(user: { discordId: string | null; googleId: string | null }): AuthProvider {
  if (user.discordId) {
    return 'discord';
  }
  if (user.googleId) {
    return 'google';
  }
  return 'google';
}

export function formatProfileResponse<T extends {
  discordId: string | null;
  googleId: string | null;
}>(user: T) {
  const { discordId, googleId, ...rest } = user;
  return {
    ...rest,
    authProvider: resolveAuthProvider({ discordId, googleId }),
  };
}

export function validateDiscordHandle(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > DISCORD_HANDLE_MAX_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid discord handle', {
      discordHandle: `Must be at most ${DISCORD_HANDLE_MAX_LENGTH} characters`,
    });
  }

  if (!DISCORD_HANDLE_PATTERN.test(trimmed)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid discord handle', {
      discordHandle: 'May only contain letters, numbers, underscores, and periods',
    });
  }

  return trimmed;
}
