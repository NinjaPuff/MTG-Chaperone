import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'user']),
});

router.get('/', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        publicName: true,
        slug: true,
        avatarUrl: true,
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
        id: true,
        displayName: true,
        publicName: true,
        slug: true,
        avatarUrl: true,
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
});

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        displayName: true,
        publicName: true,
        slug: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!profile) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', requireAuth, validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { publicName: req.body.publicName || null },
      select: {
        id: true,
        displayName: true,
        publicName: true,
        slug: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get user not yet implemented' } });
});

router.patch('/:slug', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Update user not yet implemented' } });
});

router.get('/:slug/match-history', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get match history not yet implemented' } });
});

export { router as usersRouter };
