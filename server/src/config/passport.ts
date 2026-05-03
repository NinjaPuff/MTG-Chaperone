import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Request } from 'express';
import type { PrismaClient, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { slugify, withSlugSuffix } from '../lib/slugify.js';
import type { AppConfig, Clock, Rng } from '../di/types.js';
import { loadConfig } from '../di/config.js';

async function ensureUniqueSlug(seed: string, deps: { prisma: PrismaClient; rng: Rng; clock: Clock }) {
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

type OAuthProfile = {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string | null;
  photos?: Array<{ value?: string }>;
};
type DoneFn = (error: Error | null, user?: User) => void;

async function findOrCreateDiscordUser(profile: OAuthProfile, deps: { prisma: PrismaClient; rng: Rng; clock: Clock }): Promise<User> {
  const existingByDiscord = await deps.prisma.user.findUnique({
    where: { discordId: profile.id },
  });

  if (existingByDiscord) {
    return deps.prisma.user.update({
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
  const slug = await ensureUniqueSlug(displayName, deps);
  return deps.prisma.user.create({
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

async function findOrCreateGoogleUser(profile: OAuthProfile, deps: { prisma: PrismaClient; rng: Rng; clock: Clock }): Promise<User> {
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

export function configurePassportWithDeps(deps: {
  config: AppConfig;
  prisma: PrismaClient;
  rng: Rng;
  clock: Clock;
}) {
  if (deps.config.discordClientId && deps.config.discordClientSecret) {
    passport.use(
      new DiscordStrategy(
        {
          clientID: deps.config.discordClientId,
          clientSecret: deps.config.discordClientSecret,
          callbackURL: deps.config.discordCallbackUrl,
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
            const user = await findOrCreateDiscordUser(profile, deps);
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  if (deps.config.googleClientId && deps.config.googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: deps.config.googleClientId,
          clientSecret: deps.config.googleClientSecret,
          callbackURL: deps.config.googleCallbackUrl,
        },
        async (_accessToken: string, _refreshToken: string, profile: OAuthProfile, done: DoneFn) => {
          try {
            const user = await findOrCreateGoogleUser(profile, deps);
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

export function configurePassport() {
  const config = loadConfig();
  return configurePassportWithDeps({
    config,
    prisma,
    rng: { next: () => Math.random() },
    clock: { now: () => new Date() },
  });
}
