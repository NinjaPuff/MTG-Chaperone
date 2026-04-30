import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { slugify, withSlugSuffix } from '../lib/slugify.js';

async function ensureUniqueSlug(seed: string) {
  const baseSlug = slugify(seed);
  let slug = baseSlug;
  let attempts = 0;

  while (attempts < 5) {
    const existing = await prisma.user.findUnique({ where: { slug } });
    if (!existing) {
      return slug;
    }

    attempts += 1;
    slug = withSlugSuffix(baseSlug, Math.random().toString(36).slice(2, 8));
  }

  return withSlugSuffix(baseSlug, Date.now().toString());
}

type OAuthProfile = {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string | null;
  photos?: Array<{ value?: string }>;
};
type DoneFn = (error: Error | null, user?: User) => void;

async function findOrCreateDiscordUser(profile: OAuthProfile): Promise<User> {
  const existingByDiscord = await prisma.user.findUnique({
    where: { discordId: profile.id },
  });

  if (existingByDiscord) {
    return prisma.user.update({
      where: { id: existingByDiscord.id },
      data: {
        displayName: profile.username,
        avatarUrl: profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null,
      },
    });
  }

  const displayName = profile.username || profile.displayName || 'Discord Player';
  const slug = await ensureUniqueSlug(displayName);
  return prisma.user.create({
    data: {
      discordId: profile.id,
      displayName,
      slug,
      avatarUrl: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null,
    },
  });
}

async function findOrCreateGoogleUser(profile: OAuthProfile): Promise<User> {
  const existingByGoogle = await prisma.user.findUnique({
    where: { googleId: profile.id },
  });

  if (existingByGoogle) {
    return prisma.user.update({
      where: { id: existingByGoogle.id },
      data: {
        displayName: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value || null,
      },
    });
  }

  const slug = await ensureUniqueSlug(profile.displayName || 'player');
  return prisma.user.create({
    data: {
      googleId: profile.id,
      displayName: profile.displayName || 'Google Player',
      slug,
      avatarUrl: profile.photos?.[0]?.value || null,
    },
  });
}

export function configurePassport() {
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.use(
      new DiscordStrategy(
        {
          clientID: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/api/auth/discord/callback',
          scope: ['identify', 'email'],
          passReqToCallback: true,
        },
        async (
          _req: Request,
          _accessToken: string,
          _params: unknown,
          _refreshToken: string,
          profile: OAuthProfile,
          done: DoneFn,
        ) => {
          try {
            const user = await findOrCreateDiscordUser(profile);
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
        },
        async (_accessToken: string, _refreshToken: string, profile: OAuthProfile, done: DoneFn) => {
          try {
            const user = await findOrCreateGoogleUser(profile);
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  return passport;
}
