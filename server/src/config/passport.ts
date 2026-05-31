import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Request } from 'express';
import type { PrismaClient, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AppConfig, Clock, Rng } from '../di/types.js';
import { loadConfig } from '../di/config.js';
import {
  findOrCreateDiscordUser,
  findOrCreateGoogleUser,
  type OAuthProfile,
} from '../services/oauthUserService.js';

type DoneFn = (error: Error | null, user?: User) => void;

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
