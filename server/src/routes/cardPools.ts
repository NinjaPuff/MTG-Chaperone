import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBody } from '../lib/validate.js';
import {
  adjustCardQuantityInPhase,
  bulkCreateAcquisition,
  clearPhaseAcquisitions,
  createAcquisition,
  deleteAcquisition,
  getPoolDetail,
  listAcquisitions,
} from '../services/cardPoolService.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const createAcquisitionSchema = z.object({
  phaseLabel: z.string().trim().min(1).max(100),
  cards: z
    .array(
      z.object({
        cachedCardId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1),
});

const bulkAcquisitionSchema = z.object({
  phaseLabel: z.string().trim().min(1).max(100),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        quantity: z.number().int().min(1).max(99).default(1),
      }),
    )
    .min(1),
});

async function assertCanModifyPool(poolId: string, userId: string, userRole: 'admin' | 'user') {
  const pool = await getPoolDetail(poolId);
  const isAdmin = userRole === 'admin';
  if (!isAdmin && pool.user.id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the pool owner can modify this pool');
  }
  return pool;
}

const adjustCardQuantitySchema = z.object({
  phaseLabel: z.string().trim().min(1).max(100),
  cachedCardId: z.string().trim().min(1),
  action: z.enum(['add', 'remove_one', 'remove_all']),
});

const clearPhaseSchema = z.object({
  phaseLabel: z.string().trim().min(1).max(100),
});

function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

router.get('/:poolId', requireAuth, async (req, res, next) => {
  try {
    const pool = await getPoolDetail(req.params.poolId);
    const acquisitions = await listAcquisitions(req.params.poolId);
    res.json({ data: { pool, acquisitions } });
  } catch (error) {
    next(error);
  }
});

router.get('/:poolId/export/decklist', requireAuth, async (req, res, next) => {
  try {
    const pool = await getPoolDetail(req.params.poolId);
    const acquisitions = await listAcquisitions(req.params.poolId);

    const quantityByCardName = new Map<string, number>();
    for (const acquisition of acquisitions) {
      for (const entry of acquisition.entries) {
        const cardName = entry.cachedCard.name.trim();
        if (!cardName || entry.quantity < 1) {
          continue;
        }
        quantityByCardName.set(cardName, (quantityByCardName.get(cardName) ?? 0) + entry.quantity);
      }
    }

    const deckLines = [...quantityByCardName.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([name, quantity]) => `${quantity} ${name}`);
    const deckText = deckLines.join('\n');

    const fileName = [
      sanitizeFileNamePart(pool.season.league.slug || pool.season.league.name),
      `season-${pool.season.number}`,
      sanitizeFileNamePart(pool.user.slug || pool.user.displayName),
      'pool.txt',
    ]
      .filter(Boolean)
      .join('-');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(deckText);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:poolId/acquisitions',
  requireAuth,
  validateBody(createAcquisitionSchema),
  async (req, res, next) => {
    try {
      await assertCanModifyPool(req.params.poolId, req.user!.id, req.user!.role);
      const acquisition = await createAcquisition(req.params.poolId, req.body.phaseLabel, req.body.cards);
      res.status(201).json({ data: acquisition });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:poolId/acquisitions/bulk',
  requireAuth,
  validateBody(bulkAcquisitionSchema),
  async (req, res, next) => {
    try {
      const pool = await assertCanModifyPool(req.params.poolId, req.user!.id, req.user!.role);
      const setCodes = pool.boosterProduct.setCodes.map((setCode) => setCode.setCode);
      const result = await bulkCreateAcquisition(req.params.poolId, req.body.phaseLabel, req.body.items, setCodes);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.delete('/:poolId/acquisitions/:acqId', requireAuth, async (req, res, next) => {
  try {
    await assertCanModifyPool(req.params.poolId, req.user!.id, req.user!.role);
    const acquisition = await prisma.poolAcquisition.findUnique({
      where: { id: req.params.acqId },
      select: { id: true, cardPoolId: true },
    });

    if (!acquisition || acquisition.cardPoolId !== req.params.poolId) {
      throw new AppError(404, 'NOT_FOUND', 'Acquisition not found');
    }

    await deleteAcquisition(req.params.acqId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:poolId/cards/adjust',
  requireAuth,
  validateBody(adjustCardQuantitySchema),
  async (req, res, next) => {
    try {
      await assertCanModifyPool(req.params.poolId, req.user!.id, req.user!.role);
      await adjustCardQuantityInPhase(req.params.poolId, req.body.phaseLabel, req.body.cachedCardId, req.body.action);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/:poolId/phases',
  requireAuth,
  validateBody(clearPhaseSchema),
  async (req, res, next) => {
    try {
      if (req.user!.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'Only admins can clear an entire phase');
      }
      await assertCanModifyPool(req.params.poolId, req.user!.id, req.user!.role);
      await clearPhaseAcquisitions(req.params.poolId, req.body.phaseLabel);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export { router as cardPoolsRouter };
