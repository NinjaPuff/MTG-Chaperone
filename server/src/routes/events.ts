import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { completeEvent, createEvent, getEvent, startEvent, updateEvent } from '../services/eventService.js';
import { createRound } from '../services/roundService.js';

const router = Router();

const eventSchema = z.object({
  seasonId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  pointMultiplier: z.number().positive().optional(),
  standingsOverride: z.boolean().optional(),
  config: z
    .object({
      format: z.enum(['swiss', 'seeded_swiss', 'round_robin']).optional(),
      bestOfN: z.number().int().positive().optional(),
      deckCount: z.number().int().positive().optional(),
      minDeckSize: z.number().int().positive().optional(),
      sideboardRule: z.enum(['entire_pool', 'fixed_15', 'none']).optional(),
      schedulingType: z.enum(['fixed_deadlines', 'open_window', 'weekly_auto']).optional(),
      deckLockingMode: z.enum(['required_before_round', 'free_modification', 'admin_locked']).optional(),
      seedingSource: z.enum(['previous_season', 'previous_event', 'manual']).nullable().optional(),
    })
    .optional(),
});

async function ensureEventAdmin(eventId: string, userId: string) {
  const membership = await prisma.leagueMembership.findFirst({
    where: {
      userId,
      role: 'admin',
      league: {
        seasons: {
          some: {
            events: { some: { id: eventId } },
          },
        },
      },
    },
  });

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
}

router.get('/:eventId', async (req, res, next) => {
  try {
    const event = await getEvent(req.params.eventId);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.patch('/:eventId', requireAuth, validateBody(eventSchema), async (req, res, next) => {
  try {
    await ensureEventAdmin(req.params.eventId, req.user!.id);
    const event = await updateEvent(req.params.eventId, req.body);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.post('/:eventId/start', requireAuth, async (req, res, next) => {
  try {
    await ensureEventAdmin(req.params.eventId, req.user!.id);
    const event = await startEvent(req.params.eventId);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.post('/:eventId/complete', requireAuth, async (req, res, next) => {
  try {
    await ensureEventAdmin(req.params.eventId, req.user!.id);
    const event = await completeEvent(req.params.eventId);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/rounds', async (req, res, next) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { eventId: req.params.eventId },
      include: {
        matches: {
          include: {
            player1: { select: { id: true, displayName: true, publicName: true, slug: true } },
            player2: { select: { id: true, displayName: true, publicName: true, slug: true } },
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

router.post('/:eventId/rounds', requireAuth, async (req, res, next) => {
  try {
    await ensureEventAdmin(req.params.eventId, req.user!.id);
    const round = await createRound(req.params.eventId);
    res.status(201).json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.get('/:eventId/decklists', async (req, res, next) => {
  try {
    const decklists = await prisma.decklist.findMany({
      where: { eventId: req.params.eventId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            publicName: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: decklists });
  } catch (error) {
    next(error);
  }
});

export { router as eventsRouter };
