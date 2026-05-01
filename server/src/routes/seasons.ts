import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { createEvent } from '../services/eventService.js';

const router = Router();

router.get('/:seasonId/standings', async (req, res, next) => {
  try {
    const standings = await prisma.standing.findMany({
      where: { seasonId: req.params.seasonId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            publicName: true,
            slug: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { points: 'desc' },
        { omwPercent: 'desc' },
        { gwPercent: 'desc' },
        { ogwPercent: 'desc' },
      ],
    });
    res.json({ data: standings });
  } catch (error) {
    next(error);
  }
});

router.get('/:seasonId/events', async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({
      where: { seasonId: req.params.seasonId },
      include: { config: true },
      orderBy: { orderIndex: 'asc' },
    });
    res.json({ data: events });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:seasonId/events',
  requireAuth,
  validateBody(
    z.object({
      name: z.string().min(2),
      pointMultiplier: z.number().positive().optional(),
      standingsOverride: z.boolean().optional(),
      config: z.object({
        format: z.enum(['swiss', 'seeded_swiss', 'round_robin']),
        bestOfN: z.number().int().positive().optional(),
        deckCount: z.number().int().positive().optional(),
        minDeckSize: z.number().int().positive().optional(),
        sideboardRule: z.enum(['entire_pool', 'fixed_15', 'none']).optional(),
        schedulingType: z.enum(['fixed_deadlines', 'open_window', 'weekly_auto']).optional(),
        deckLockingMode: z.enum(['required_before_round', 'free_modification', 'admin_locked']).optional(),
        seedingSource: z.enum(['previous_season', 'previous_event', 'manual']).nullable().optional(),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const season = await prisma.season.findUnique({
        where: { id: req.params.seasonId },
        include: {
          league: {
            select: {
              memberships: {
                where: {
                  userId: req.user!.id,
                  role: 'admin',
                },
              },
            },
          },
        },
      });

      if (!season) {
        throw new AppError(404, 'NOT_FOUND', 'Season not found');
      }
      if (season.league.memberships.length === 0) {
        throw new AppError(403, 'FORBIDDEN', 'Admin access required');
      }

      const event = await createEvent({
        seasonId: req.params.seasonId,
        ...req.body,
      });
      res.status(201).json({ data: event });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:seasonId/card-pools', async (req, res, next) => {
  try {
    const season = await prisma.season.findUnique({
      where: { id: req.params.seasonId },
      select: { id: true },
    });
    if (!season) {
      throw new AppError(404, 'NOT_FOUND', 'Season not found');
    }
    const cardPools = await prisma.cardPool.findMany({
      where: { seasonId: season.id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            publicName: true,
            slug: true,
          },
        },
        boosterProduct: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: cardPools });
  } catch (error) {
    next(error);
  }
});

export { router as seasonsRouter };
