import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createDecklist,
  getDecklistById,
  listDecklistsForSeason,
  submitDecklist,
  updateDecklist,
  validateDecklist,
} from '../services/decklistService.js';
import { validateBody } from '../lib/validate.js';

const router = Router();

const createDecklistSchema = z.object({
  eventId: z.string().uuid(),
  roundId: z.string().uuid(),
  orderIndex: z.number().int().min(0).optional(),
  name: z.string().min(1).max(100).optional(),
  prepopulateFromPrevious: z.boolean().optional(),
});

const deckEntrySchema = z.object({
  cachedCardId: z.string().min(1),
  quantity: z.number().int().min(1),
  zone: z.enum(['main', 'sideboard']),
});

const updateDecklistSchema = z
  .object({
    name: z.string().max(100).optional(),
    entries: z.array(deckEntrySchema).optional(),
  })
  .refine((value) => typeof value.name === 'string' || Array.isArray(value.entries), {
    message: 'At least one field must be provided',
    path: ['name'],
  });

router.get('/my-season/:seasonId', requireAuth, async (req, res, next) => {
  try {
    const decklists = await listDecklistsForSeason(req.user.id, req.params.seasonId);
    res.json({ data: decklists });
  } catch (error) {
    next(error);
  }
});

router.get('/:decklistId', requireAuth, async (req, res, next) => {
  try {
    const decklist = await getDecklistById(req.params.decklistId, req.user.id, req.user.role === 'admin');
    res.json({ data: decklist });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, validateBody(createDecklistSchema), async (req, res, next) => {
  try {
    const decklist = await createDecklist({
      userId: req.user.id,
      eventId: req.body.eventId,
      roundId: req.body.roundId,
      orderIndex: req.body.orderIndex,
      name: req.body.name,
      prepopulateFromPrevious: req.body.prepopulateFromPrevious,
    });
    res.status(201).json({ data: decklist });
  } catch (error) {
    next(error);
  }
});

router.patch('/:decklistId', requireAuth, validateBody(updateDecklistSchema), async (req, res, next) => {
  try {
    const updated = await updateDecklist(req.params.decklistId, req.user.id, req.user.role === 'admin', {
      name: req.body.name,
      entries: req.body.entries,
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/:decklistId/submit', requireAuth, async (req, res, next) => {
  try {
    const submitted = await submitDecklist(req.params.decklistId, req.user.id, req.user.role === 'admin');
    res.json({ data: submitted });
  } catch (error) {
    next(error);
  }
});

router.post('/:decklistId/import', (_req, res) => {
  // TODO: Import decklist from external format
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Import decklist not yet implemented' } });
});

router.get('/:decklistId/export/:format', (_req, res) => {
  // TODO: Export decklist in specified format
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Export decklist not yet implemented' } });
});

router.get('/:decklistId/validate', requireAuth, async (req, res, next) => {
  try {
    const validation = await validateDecklist(req.params.decklistId, req.user.id, req.user.role === 'admin');
    res.json({ data: validation });
  } catch (error) {
    next(error);
  }
});

export { router as decklistsRouter };
