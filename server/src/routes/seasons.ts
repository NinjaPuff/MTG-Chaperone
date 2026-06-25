import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, requireAuth, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { createEvent, createRoundRobinEventSeries } from '../services/eventService.js';
import { listVisibleDecklistsForSeason } from '../services/decklistService.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';

const router = Router();
const EVENT_FORMATS = [
  'swiss',
  'seeded_swiss',
  'round_robin',
  'single_elimination',
  'double_elimination',
  'custom_10_player',
] as const;
const GRAND_FINALS_FORMATS = new Set(['double_elimination', 'custom_10_player']);

router.get('/:seasonId/standings', async (req, res, next) => {
  try {
    const standings = await prisma.standing.findMany({
      where: { seasonId: req.params.seasonId },
      include: {
        user: {
          select: USER_PUBLIC_SELECT,
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
      include: {
        config: true,
        rounds: {
          select: { status: true },
        },
      },
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
  requireAdmin,
  validateBody(
    z.object({
      name: z.string().min(2),
      pointMultiplier: z.number().positive().optional(),
      standingsOverride: z.boolean().optional(),
      config: z
        .object({
          format: z.enum(EVENT_FORMATS),
          bestOfN: z.number().int().positive().optional(),
          deckCount: z.number().int().positive().optional(),
          minDeckSize: z.number().int().positive().optional(),
          sideboardRule: z.enum(['entire_pool', 'fixed_15', 'none']).optional(),
          schedulingType: z.enum(['fixed_deadlines', 'open_window', 'weekly_auto']).optional(),
          deckLockingMode: z.enum(['required_before_round', 'free_modification', 'admin_locked']).optional(),
          seedingSource: z.enum(['previous_season', 'previous_event', 'current_season', 'manual']).nullable().optional(),
          grandFinalsReset: z.boolean().optional(),
        })
        .superRefine((value, context) => {
          if (value.grandFinalsReset && !GRAND_FINALS_FORMATS.has(value.format)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'grandFinalsReset is only valid for double_elimination and custom_10_player formats',
              path: ['grandFinalsReset'],
            });
          }
        }),
    }),
  ),
  async (req, res, next) => {
    try {
      const season = await prisma.season.findUnique({
        where: { id: req.params.seasonId },
        select: { id: true },
      });

      if (!season) {
        throw new AppError(404, 'NOT_FOUND', 'Season not found');
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

router.post(
  '/:seasonId/events/round-robin-series',
  requireAuth,
  requireAdmin,
  validateBody(
    z.object({
      baseName: z.string().min(2),
      roundsPerEvent: z.number().int().positive().max(20).default(3),
      pointMultiplier: z.number().positive().optional(),
      standingsOverride: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const season = await prisma.season.findUnique({
        where: { id: req.params.seasonId },
        select: { id: true },
      });

      if (!season) {
        throw new AppError(404, 'NOT_FOUND', 'Season not found');
      }

      const events = await createRoundRobinEventSeries({
        seasonId: req.params.seasonId,
        baseName: req.body.baseName,
        roundsPerEvent: req.body.roundsPerEvent,
        pointMultiplier: req.body.pointMultiplier,
        standingsOverride: req.body.standingsOverride,
      });
      res.status(201).json({ data: events });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:seasonId/decklists', optionalAuth, async (req, res, next) => {
  try {
    const season = await prisma.season.findUnique({
      where: { id: req.params.seasonId },
      select: {
        id: true,
        decklistVisibility: true,
      },
    });
    if (!season) {
      throw new AppError(404, 'NOT_FOUND', 'Season not found');
    }

    const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
    const decklists = await listVisibleDecklistsForSeason(season.id, viewer);
    res.json({
      data: decklists,
      meta: { decklistVisibility: season.decklistVisibility },
    });
  } catch (error) {
    next(error);
  }
});

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
          select: USER_PUBLIC_SELECT,
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

export function createSeasonsRouter() {
  return router;
}

export const seasonsRouter = createSeasonsRouter();
