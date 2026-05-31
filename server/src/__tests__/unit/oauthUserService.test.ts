import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { findOrCreateDiscordUser, findOrCreateGoogleUser } from '../../services/oauthUserService.js';

const deps = {
  prisma: prismaMock as any,
  rng: { next: () => 0.5 },
  clock: { now: () => new Date('2024-01-01T00:00:00.000Z') },
};

const discordProfile = {
  id: 'discord-1',
  username: 'discord_user',
  avatar: 'avatar-hash',
};

const googleProfile = {
  id: 'google-1',
  displayName: 'Google User',
  photos: [{ value: 'https://example.com/photo.jpg' }],
};

describe('oauthUserService', () => {
  beforeEach(() => {
    resetPrismaMock();
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { slug?: string; discordId?: string; googleId?: string } }) => {
      if (args.where.slug) {
        return null;
      }
      return undefined;
    });
  });

  describe('findOrCreateDiscordUser', () => {
    it('creates a new user with discordHandle from username', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'user-1',
        discordId: 'discord-1',
        displayName: 'discord_user',
        discordHandle: 'discord_user',
      });

      await findOrCreateDiscordUser(discordProfile, deps);

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discordHandle: 'discord_user',
            displayName: 'discord_user',
          }),
        }),
      );
    });

    it('does not overwrite discordHandle on re-login when already set', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        discordId: 'discord-1',
        discordHandle: 'custom',
      });
      prismaMock.user.update.mockResolvedValue({ id: 'user-1' });

      await findOrCreateDiscordUser(discordProfile, deps);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            discordHandle: expect.anything(),
          }),
        }),
      );
    });

    it('backfills discordHandle on re-login when null', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        discordId: 'discord-1',
        discordHandle: null,
      });
      prismaMock.user.update.mockResolvedValue({ id: 'user-1' });

      await findOrCreateDiscordUser(discordProfile, deps);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discordHandle: 'discord_user',
          }),
        }),
      );
    });
  });

  describe('findOrCreateGoogleUser', () => {
    it('creates a new user without discordHandle', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValue({ id: 'user-2' });

      await findOrCreateGoogleUser(googleProfile, deps);

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            discordHandle: expect.anything(),
          }),
        }),
      );
    });
  });
});
