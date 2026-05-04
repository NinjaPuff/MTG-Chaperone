import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { bulkImportSet, bulkLookupByName, getCard, getCardFaces, searchCards } from '../services/scryfallService.js';

const router = Router();

router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    const sets = typeof req.query.sets === 'string' ? req.query.sets.split(',') : [];
    if (!query) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Query parameter q is required' } });
      return;
    }
    const cards = await searchCards(query, sets);
    res.json({ data: cards });
  } catch (error) {
    next(error);
  }
});

router.get('/:scryfallId', async (req, res, next) => {
  try {
    const card = await getCard(req.params.scryfallId);
    res.json({ data: card });
  } catch (error) {
    next(error);
  }
});

router.get('/:scryfallId/faces', async (req, res, next) => {
  try {
    const faces = await getCardFaces(req.params.scryfallId);
    res.json({ data: { faces } });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/bulk-lookup',
  requireAuth,
  validateBody(
    z.object({
      names: z.array(z.string().min(1)).min(1),
    }),
  ),
  async (req, res, next) => {
    try {
      const cards = await bulkLookupByName(req.body.names);
      res.json({ data: cards });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/bulk-import', requireAuth, validateBody(z.object({ setCodes: z.array(z.string().min(2)).min(1) })), async (req, res, next) => {
  try {
    const result = await bulkImportSet(req.body.setCodes);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export { router as cardsRouter };
