import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { formatProfileResponse, validateDiscordHandle } from '../lib/userProfileRules.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';
import { getPublicProfile, getUserMatchHistory } from '../services/userProfileService.js';

const router = Router();

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'user']),
});

router.get('/', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        ...USER_PUBLIC_SELECT,
        role: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/role', requireAuth, requireAdmin, validateBody(updateRoleSchema), async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true },
    });

    if (!target) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    if (target.role === 'admin' && req.body.role === 'user') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Cannot demote the last site admin');
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: req.body.role },
      select: {
        ...USER_PUBLIC_SELECT,
        role: true,
        createdAt: true,
      },
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

const updateProfileSchema = z.object({
  publicName: z.string().max(50).trim().nullable(),
  discordHandle: z.string().max(32).trim().nullable().optional(),
});

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        ...USER_PUBLIC_SELECT,
        discordId: true,
        googleId: true,
        role: true,
        createdAt: true,
      },
    });

    if (!profile) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    res.json({ data: formatProfileResponse(profile) });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', requireAuth, validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { discordId: true },
    });

    if (!current) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const data: { publicName: string | null; discordHandle?: string | null } = {
      publicName: req.body.publicName ?? null,
    };

    if ('discordHandle' in req.body) {
      if (current.discordId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Discord handle cannot be changed for Discord sign-in accounts', {
          discordHandle: 'Synced from your Discord account',
        });
      }
      data.discordHandle = validateDiscordHandle(req.body.discordHandle);
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        ...USER_PUBLIC_SELECT,
        discordId: true,
        googleId: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ data: formatProfileResponse(updated) });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug/match-history', optionalAuth, async (req, res, next) => {
  try {
    const seasonId = typeof req.query.seasonId === 'string' ? req.query.seasonId : undefined;
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const result = await getUserMatchHistory(req.params.slug, { seasonId, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const profile = await getPublicProfile(req.params.slug, req.user?.id ?? null);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
