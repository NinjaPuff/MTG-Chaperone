import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, requireAuth, getAuthUser, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { canViewFullSchedule } from '../lib/visibilityRules.js';
import { completeEvent, createEvent, getEvent, resetEvent, startEvent, updateEvent } from '../services/eventService.js';
import { createRound } from '../services/roundService.js';
import { recomputeStandings } from '../services/standingsService.js';
import { getEventResults } from '../services/eventRankingService.js';
import { listMyDecklistsForEvent, listMyDecklistsForRound, listVisibleDecklistsForEvent } from '../services/decklistService.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';
import { getBracketState } from '../services/bracketService.js';
import { minDeckSizeSchema } from '../lib/minDeckSizeSchema.js';

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
const eventConfigSchema = z
  .object({
    format: z.enum(EVENT_FORMATS).optional(),
    bestOfN: z.number().int().positive().optional(),
    deckCount: z.number().int().positive().optional(),
    minDeckSize: minDeckSizeSchema.optional(),
    sideboardRule: z.enum(['entire_pool', 'fixed_15', 'none']).optional(),
    schedulingType: z.enum(['fixed_deadlines', 'open_window', 'weekly_auto']).optional(),
    deckLockingMode: z.enum(['required_before_round', 'free_modification', 'admin_locked']).optional(),
    seedingSource: z.enum(['previous_season', 'previous_event', 'current_season', 'manual']).nullable().optional(),
    grandFinalsReset: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.grandFinalsReset && value.format && !GRAND_FINALS_FORMATS.has(value.format)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'grandFinalsReset is only valid for double_elimination and custom_10_player formats',
        path: ['grandFinalsReset'],
      });
    }
  });

const eventSchema = z.object({
  seasonId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  pointMultiplier: z.number().positive().optional(),
  standingsOverride: z.boolean().optional(),
  config: eventConfigSchema.optional(),
});

const eventSeedsSchema = z.object({
  seeds: z
    .array(
      z.object({
        userId: z.string().uuid(),
        seedNum: z.number().int().positive(),
      }),
    )
    .min(1),
});

router.get('/:eventId', async (req, res, next) => {
  try {
    const event = await getEvent(req.params.eventId);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/results', async (req, res, next) => {
  try {
    const results = await getEventResults(req.params.eventId);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/bracket', async (req, res, next) => {
  try {
    const data = await getBracketState(req.params.eventId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:eventId', requireAuth, requireAdmin, validateBody(eventSchema), async (req, res, next) => {
  try {
    const shouldRecompute = req.body.pointMultiplier !== undefined || req.body.standingsOverride !== undefined;
    const event = await updateEvent(req.params.eventId, req.body);
    if (shouldRecompute) {
      await recomputeStandings(event.season.id);
    }
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.post('/:eventId/start', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const event = await startEvent(req.params.eventId);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.post('/:eventId/complete', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const eventMeta = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: { seasonId: true },
    });
    if (!eventMeta) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }

    const event = await completeEvent(req.params.eventId);
    await recomputeStandings(eventMeta.seasonId);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.post('/:eventId/reset', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const eventMeta = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: { seasonId: true },
    });
    if (!eventMeta) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }

    const event = await resetEvent(req.params.eventId);
    await recomputeStandings(eventMeta.seasonId);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.delete('/:eventId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: { id: true, seasonId: true },
    });
    if (!event) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }

    await prisma.event.delete({
      where: { id: req.params.eventId },
    });
    await recomputeStandings(event.seasonId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/seeds', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: { id: true },
    });
    if (!event) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }

    const seeds = await prisma.eventSeed.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { seedNum: 'asc' },
      include: {
        user: {
          select: USER_PUBLIC_SELECT,
        },
      },
    });
    res.json({ data: seeds });
  } catch (error) {
    next(error);
  }
});

router.put('/:eventId/seeds', requireAuth, requireAdmin, validateBody(eventSeedsSchema), async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: {
        id: true,
        status: true,
        season: {
          select: {
            league: {
              select: {
                memberships: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });
    if (!event) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }
    if (event.status !== 'setup') {
      throw new AppError(409, 'INVALID_EVENT_STATE', 'Seeds can only be updated while event is in setup');
    }

    const memberIds = event.season.league.memberships.map((membership) => membership.userId);
    const memberIdSet = new Set(memberIds);
    const seeds = req.body.seeds as Array<{ userId: string; seedNum: number }>;

    if (seeds.length !== memberIds.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Seeds must include every league member exactly once');
    }

    const uniqueUserIds = new Set(seeds.map((seed) => seed.userId));
    const uniqueSeedNums = new Set(seeds.map((seed) => seed.seedNum));
    if (uniqueUserIds.size !== seeds.length || uniqueSeedNums.size !== seeds.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Seed users and seed numbers must be unique');
    }

    const hasNonMember = seeds.some((seed) => !memberIdSet.has(seed.userId));
    if (hasNonMember) {
      throw new AppError(400, 'VALIDATION_ERROR', 'All seeds must belong to league members');
    }

    await prisma.$transaction(async (tx) => {
      await tx.eventSeed.deleteMany({ where: { eventId: req.params.eventId } });
      await tx.eventSeed.createMany({
        data: seeds.map((seed) => ({
          eventId: req.params.eventId,
          userId: seed.userId,
          seedNum: seed.seedNum,
        })),
      });
    });

    const updatedSeeds = await prisma.eventSeed.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { seedNum: 'asc' },
      include: {
        user: {
          select: USER_PUBLIC_SELECT,
        },
      },
    });

    res.json({ data: updatedSeeds });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/rounds', optionalAuth, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: {
        season: {
          select: {
            scheduleVisibility: true,
            poolVisibility: true,
            decklistVisibility: true,
          },
        },
      },
    });
    if (!event) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }

    const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
    const showFullSchedule = canViewFullSchedule(event.season, viewer);

    const rounds = await prisma.round.findMany({
      where: {
        eventId: req.params.eventId,
        ...(showFullSchedule ? {} : { status: { not: 'not_started' } }),
      },
      include: {
        matches: {
          include: {
            player1: { select: USER_PUBLIC_SELECT },
            player2: { select: USER_PUBLIC_SELECT },
            gameResults: true,
          },
        },
      },
      orderBy: { roundNumber: 'asc' },
    });
    res.json({ data: rounds });
  } catch (error) {
    next(error);
  }
});

router.post('/:eventId/rounds', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const round = await createRound(req.params.eventId);
    res.status(201).json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/decklists', optionalAuth, async (req, res, next) => {
  try {
    const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
    const decklists = await listVisibleDecklistsForEvent(req.params.eventId, viewer);
    res.json({ data: decklists });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/rounds/:roundId/my-decklists', requireAuth, async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const data = await listMyDecklistsForRound(req.params.eventId, req.params.roundId, user.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/my-decklists', requireAuth, async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const data = await listMyDecklistsForEvent(req.params.eventId, user.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export function createEventsRouter() {
  return router;
}

export const eventsRouter = createEventsRouter();
