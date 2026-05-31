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

const router = Router();

router.use(requireAuth, requireAdmin);

const importSetSchema = z.object({
  setCode: z.string().trim().min(2),
});

const importSetsSchema = z.object({
  setCodes: z.array(z.string().trim().min(2)).min(1),
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

router.post('/matches/batch-report', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Batch report matches not yet implemented' } });
});

router.get('/disputes', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List disputes not yet implemented' } });
});

router.post('/players/:userId/drop', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Drop player not yet implemented' } });
});

export { router as adminRouter };
