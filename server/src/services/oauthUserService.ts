import type { PrismaClient, User } from '@prisma/client';
import { slugify, withSlugSuffix } from '../lib/slugify.js';
import type { Clock, Rng } from '../di/types.js';

export type OAuthProfile = {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string | null;
  photos?: Array<{ value?: string }>;
};

type OAuthDeps = { prisma: PrismaClient; rng: Rng; clock: Clock };

async function ensureUniqueSlug(seed: string, deps: OAuthDeps) {
  const baseSlug = slugify(seed);
  let slug = baseSlug;
  let attempts = 0;

  while (attempts < 5) {
    const existing = await deps.prisma.user.findUnique({ where: { slug } });
    if (!existing) {
      return slug;
    }

    attempts += 1;
    slug = withSlugSuffix(baseSlug, deps.rng.next().toString(36).slice(2, 8));
  }

  return withSlugSuffix(baseSlug, deps.clock.now().getTime().toString());
}

export async function findOrCreateDiscordUser(profile: OAuthProfile, deps: OAuthDeps): Promise<User> {
  const existingByDiscord = await deps.prisma.user.findUnique({
    where: { discordId: profile.id },
  });

  if (existingByDiscord) {
    const data: {
      displayName?: string;
      avatarUrl: string | null;
      discordHandle?: string;
    } = {
      displayName: profile.username,
      avatarUrl: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null,
    };

    if (existingByDiscord.discordHandle == null && profile.username) {
      data.discordHandle = profile.username;
    }

    return deps.prisma.user.update({
      where: { id: existingByDiscord.id },
      data,
    });
  }

  const displayName = profile.username || profile.displayName || 'Discord Player';
  const slug = await ensureUniqueSlug(displayName, deps);
  return deps.prisma.user.create({
    data: {
      discordId: profile.id,
      displayName,
      discordHandle: profile.username ?? null,
      slug,
      avatarUrl: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null,
    },
  });
}

export async function findOrCreateGoogleUser(profile: OAuthProfile, deps: OAuthDeps): Promise<User> {
  const existingByGoogle = await deps.prisma.user.findUnique({
    where: { googleId: profile.id },
  });

  if (existingByGoogle) {
    return deps.prisma.user.update({
      where: { id: existingByGoogle.id },
      data: {
        displayName: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value || null,
      },
    });
  }

  const slug = await ensureUniqueSlug(profile.displayName || 'player', deps);
  return deps.prisma.user.create({
    data: {
      googleId: profile.id,
      displayName: profile.displayName || 'Google Player',
      slug,
      avatarUrl: profile.photos?.[0]?.value || null,
    },
  });
}
