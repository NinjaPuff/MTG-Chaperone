import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { getBoosterProduct } from '../services/boosterProductService.js';
import {
  bulkImportSet,
  getSetCacheStats,
  importSetFromScryfall,
} from '../services/scryfallService.js';
import {
  clearAndImportSet,
  resolveStaleReferences,
  type ClearAndImportSetResult,
  type DeletedCachedCard,
  type StaleReference,
} from '../services/cardCacheService.js';
import { dropPlayer } from '../services/playerDropService.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const importSetSchema = z.object({
  setCode: z.string().trim().min(2),
});

const importSetsSchema = z.object({
  setCodes: z.array(z.string().trim().min(2)).min(1),
});

const clearAndImportSetSchema = z.object({
  setCode: z.string().trim().min(2),
});

const clearAndImportSetsSchema = z.object({
  setCodes: z.array(z.string().trim().min(2)).min(1),
});

const resolveStaleActionSchema = z.union([
  z.object({
    target: z.literal('pool'),
    entryId: z.string().trim().min(1),
    action: z.literal('replace'),
    replacementScryfallId: z.string().trim().min(1),
  }),
  z.object({
    target: z.literal('pool'),
    entryId: z.string().trim().min(1),
    action: z.literal('remove'),
  }),
  z.object({
    target: z.literal('decklist'),
    entryId: z.string().trim().min(1),
    action: z.literal('replace'),
    replacementScryfallId: z.string().trim().min(1),
  }),
  z.object({
    target: z.literal('decklist'),
    entryId: z.string().trim().min(1),
    action: z.literal('remove'),
  }),
]);

const resolveStaleReferencesSchema = z.object({
  actions: z.array(resolveStaleActionSchema).min(1),
});

const dropPlayerSchema = z.object({
  seasonId: z.string().uuid(),
  eventId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

async function buildImportResponse(
  importResults: Array<{ setCode: string; imported: number; error?: string }>,
) {
  const stats = await getSetCacheStats(importResults.map((result) => result.setCode));
  const statsBySetCode = new Map(stats.map((entry) => [entry.setCode, entry]));

  const results = importResults.map((result) => {
    const stat = statsBySetCode.get(result.setCode);
    return {
      setCode: result.setCode,
      imported: result.imported,
      cachedCount: stat?.cachedCount ?? 0,
      lastFetched: stat?.lastFetched ?? null,
      ...(result.error ? { error: result.error } : {}),
    };
  });

  return {
    results,
    totalImported: importResults.reduce((sum, result) => sum + result.imported, 0),
  };
}

async function buildClearAndImportResponse(clearAndImportResults: ClearAndImportSetResult[]) {
  const stats = await getSetCacheStats(clearAndImportResults.map((result) => result.setCode));
  const statsBySetCode = new Map(stats.map((entry) => [entry.setCode, entry]));

  const results = clearAndImportResults.map((result) => {
    const stat = statsBySetCode.get(result.setCode);
    return {
      setCode: result.setCode,
      imported: result.imported,
      deleted: result.deleted,
      deletedCards: result.deletedCards,
      cachedCount: stat?.cachedCount ?? 0,
      lastFetched: stat?.lastFetched ?? null,
      ...(result.error ? { error: result.error } : {}),
    };
  });

  const deletedCards = new Map<string, DeletedCachedCard>();
  const staleReferences = new Map<string, StaleReference>();
  for (const result of clearAndImportResults) {
    for (const card of result.deletedCards) {
      deletedCards.set(card.scryfallId, card);
    }
    for (const reference of result.staleReferences) {
      staleReferences.set(reference.scryfallId, reference);
    }
  }

  return {
    results,
    totalImported: clearAndImportResults.reduce((sum, result) => sum + result.imported, 0),
    totalDeleted: clearAndImportResults.reduce((sum, result) => sum + result.deleted, 0),
    deletedCards: [...deletedCards.values()],
    staleReferences: [...staleReferences.values()],
  };
}

router.get('/card-cache/stats', async (req, res, next) => {
  try {
    const rawSetCodes = typeof req.query.setCodes === 'string' ? req.query.setCodes : '';
    const setCodes = rawSetCodes
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    if (setCodes.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Query parameter setCodes is required');
    }

    const stats = await getSetCacheStats(setCodes);
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
});

router.post('/card-cache/import-set', validateBody(importSetSchema), async (req, res, next) => {
  try {
    const imported = await importSetFromScryfall(req.body.setCode);
    const data = await buildImportResponse([imported]);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/card-cache/import-sets', validateBody(importSetsSchema), async (req, res, next) => {
  try {
    const imported = await bulkImportSet(req.body.setCodes);
    const data = await buildImportResponse(imported.results);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/card-cache/import-booster-product/:id', async (req, res, next) => {
  try {
    const product = await getBoosterProduct(req.params.id);
    const setCodes = [
      ...new Set(
        product.setCodes
          .map((entry) => entry.setCode.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];

    if (setCodes.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Booster product has no set codes configured');
    }

    const importResults: Array<{ setCode: string; imported: number; error?: string }> = [];
    for (const setCode of setCodes) {
      try {
        importResults.push(await importSetFromScryfall(setCode));
      } catch (error) {
        const message = error instanceof AppError ? error.message : 'Import failed';
        importResults.push({ setCode, imported: 0, error: message });
      }
    }

    const data = await buildImportResponse(importResults);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/card-cache/clear-and-import-set', validateBody(clearAndImportSetSchema), async (req, res, next) => {
  try {
    const result = await clearAndImportSet(req.body.setCode);
    const data = await buildClearAndImportResponse([result]);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/card-cache/clear-and-import-sets', validateBody(clearAndImportSetsSchema), async (req, res, next) => {
  try {
    const setCodes = [...new Set<string>(req.body.setCodes.map((code: string) => code.trim().toUpperCase()).filter(Boolean))];
    const clearAndImportResults: ClearAndImportSetResult[] = [];
    for (const setCode of setCodes) {
      clearAndImportResults.push(await clearAndImportSet(setCode));
    }
    const data = await buildClearAndImportResponse(clearAndImportResults);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/card-cache/clear-and-import-booster-product/:id', async (req, res, next) => {
  try {
    const product = await getBoosterProduct(req.params.id);
    const setCodes = [
      ...new Set(
        product.setCodes
          .map((entry) => entry.setCode.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];

    if (setCodes.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Booster product has no set codes configured');
    }

    const clearAndImportResults: ClearAndImportSetResult[] = [];
    for (const setCode of setCodes) {
      clearAndImportResults.push(await clearAndImportSet(setCode));
    }

    const data = await buildClearAndImportResponse(clearAndImportResults);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/card-cache/resolve-stale-references',
  validateBody(resolveStaleReferencesSchema),
  async (req, res, next) => {
    try {
      const data = await resolveStaleReferences(req.body.actions);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/matches/batch-report', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Batch report matches not yet implemented' } });
});

router.get('/disputes', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List disputes not yet implemented' } });
});

router.post('/players/:userId/drop', validateBody(dropPlayerSchema), async (req, res, next) => {
  try {
    const data = await dropPlayer({
      userId: req.params.userId,
      seasonId: req.body.seasonId,
      eventId: req.body.eventId,
      reason: req.body.reason,
      droppedById: req.user!.id,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

export { router as adminRouter };
