import { Router } from 'express';
import passport from 'passport';
import { signToken } from '../config/jwt.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppDeps } from '../di/types.js';
import { loadConfig } from '../di/config.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';
import { formatProfileResponse } from '../lib/userProfileRules.js';

function isStrategyConfigured(name: 'discord' | 'google') {
  return Boolean((passport as unknown as { _strategy?: (strategy: string) => unknown })._strategy?.(name));
}

export function createAuthRouter(deps?: Pick<AppDeps, 'config' | 'prisma' | 'services'>) {
  const router = Router();
  const config = deps?.config ?? loadConfig();
  const authMw = deps?.services.auth.requireAuth ?? requireAuth;
  const prismaClient = deps?.prisma ?? prisma;
  const clientUrl = config.clientUrl;
  const oauthFailureRedirect = `${clientUrl}/login?error=oauth_failed`;

  function buildCallbackUrl(user: Express.User) {
    const token = signToken({ userId: user.id, displayName: user.displayName });
    return `${clientUrl}/auth/callback?token=${encodeURIComponent(token)}`;
  }

  router.get('/discord', (req, res, next) => {
    if (!isStrategyConfigured('discord')) {
      res.status(503).json({
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'Discord OAuth is not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.',
        },
      });
      return;
    }
    passport.authenticate('discord')(req, res, next);
  });

  router.get(
    '/discord/callback',
    (req, res, next) => {
      if (!isStrategyConfigured('discord')) {
        res.redirect(`${clientUrl}/login?error=discord_not_configured`);
        return;
      }
      passport.authenticate('discord', { session: false, failureRedirect: oauthFailureRedirect })(req, res, next);
    },
    (req, res) => {
      const user = req.user as Express.User | undefined;
      if (!user) {
        res.redirect(oauthFailureRedirect);
        return;
      }
      res.redirect(buildCallbackUrl(user));
    },
  );

  router.get('/google', (req, res, next) => {
    if (!isStrategyConfigured('google')) {
      res.status(503).json({
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        },
      });
      return;
    }
    passport.authenticate('google', { scope: ['profile'] })(req, res, next);
  });

  router.get(
    '/google/callback',
    (req, res, next) => {
      if (!isStrategyConfigured('google')) {
        res.redirect(`${clientUrl}/login?error=google_not_configured`);
        return;
      }
      passport.authenticate('google', { session: false, failureRedirect: oauthFailureRedirect })(req, res, next);
    },
    (req, res) => {
      const user = req.user as Express.User | undefined;
      if (!user) {
        res.redirect(oauthFailureRedirect);
        return;
      }
      res.redirect(buildCallbackUrl(user));
    },
  );

  router.get('/me', authMw, async (req, res, next) => {
    try {
      const user = await prismaClient.user.findUnique({
        where: { id: req.user!.id },
        select: {
          ...USER_PUBLIC_SELECT,
          discordId: true,
          googleId: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
        return;
      }

      res.json({ data: formatProfileResponse(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', (_req, res) => {
    res.json({ success: true });
  });

  return router;
}

export const authRouter = createAuthRouter();
