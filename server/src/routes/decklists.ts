import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, getAuthUser, optionalAuth } from '../middleware/auth.js';
import {
  createDecklist,
  deleteDecklist,
  getDecklistById,
  listDecklistsForSeason,
  listVisibleDecklistsForSeason,
  submitDecklist,
  unsubmitDecklist,
  updateDecklist,
  validateDecklist,
} from '../services/decklistService.js';
import { createDecklistShare } from '../services/decklistShareService.js';
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

const shareEntrySchema = z.object({
  scryfallId: z.string().min(1),
  quantity: z.number().int().min(1),
  zone: z.enum(['main', 'sideboard']),
  name: z.string(),
  layout: z.string().nullable(),
  manaCost: z.string().nullable(),
  typeLine: z.string(),
  cmc: z.number(),
  colorIdentity: z.array(z.string()),
  setCode: z.string().nullable().optional(),
  collectorNumber: z.string().nullable().optional(),
});

const sharePayloadSchema = z.object({
  v: z.literal(1),
  ownerDisplayName: z.string(),
  deckName: z.string(),
  eventName: z.string(),
  roundNumber: z.number().int(),
  status: z.enum(['draft', 'submitted', 'locked']),
  entries: z.array(shareEntrySchema),
});

router.get('/my-season/:seasonId', requireAuth, async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const decklists = await listDecklistsForSeason(user.id, req.params.seasonId);
    res.json({ data: decklists });
  } catch (error) {
    next(error);
  }
});

router.get('/:decklistId', optionalAuth, async (req, res, next) => {
  try {
    const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
    const decklist = await getDecklistById(req.params.decklistId, viewer);
    res.json({ data: decklist });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, validateBody(createDecklistSchema), async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const decklist = await createDecklist({
      userId: user.id,
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
    const user = getAuthUser(req);
    const updated = await updateDecklist(req.params.decklistId, user.id, user.role === 'admin', {
      name: req.body.name,
      entries: req.body.entries,
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/:decklistId/share', requireAuth, validateBody(sharePayloadSchema), async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const result = await createDecklistShare({
      user: {
        id: user.id,
        displayName: user.displayName,
        publicName: user.publicName,
        role: user.role,
      },
      decklistId: req.params.decklistId,
      payload: req.body,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/:decklistId/submit', requireAuth, async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const submitted = await submitDecklist(req.params.decklistId, user.id, user.role === 'admin');
    res.json({ data: submitted });
  } catch (error) {
    next(error);
  }
});

router.post('/:decklistId/unsubmit', requireAuth, async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const unsubmitted = await unsubmitDecklist(req.params.decklistId, user.id, user.role === 'admin');
    res.json({ data: unsubmitted });
  } catch (error) {
    next(error);
  }
});

router.delete('/:decklistId', requireAuth, async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const deleted = await deleteDecklist(req.params.decklistId, user.id, user.role === 'admin');
    res.json({ data: deleted });
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
    const user = getAuthUser(req);
    const validation = await validateDecklist(req.params.decklistId, user.id, user.role === 'admin');
    res.json({ data: validation });
  } catch (error) {
    next(error);
  }
});

export { router as decklistsRouter };
