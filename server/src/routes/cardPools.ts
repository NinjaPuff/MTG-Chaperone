import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBody } from '../lib/validate.js';
import { canViewPool } from '../lib/visibilityRules.js';
import { assertOwnerPhaseAllowed, isSeasonLocked } from '../lib/poolRules.js';
import {
  adjustCardQuantityInPhase,
  bulkResolveAcquisitionItems,
  clearPhaseAcquisitions,
  createAcquisition,
  deleteAcquisition,
  getPoolDetail,
  listAcquisitions,
} from '../services/cardPoolService.js';
import { buildPoolDecklistExport } from '@mtg-league/shared';
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

async function assertCanModifyPool(
  poolId: string,
  userId: string,
  userRole: 'admin' | 'user',
  options?: { phaseLabel?: string },
) {
  const pool = await getPoolDetail(poolId);
  const isAdmin = userRole === 'admin';
  if (!isAdmin && pool.user.id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the pool owner can modify this pool');
  }
  if (!isAdmin) {
    const events = await prisma.event.findMany({
      where: { seasonId: pool.seasonId },
      select: { status: true },
    });
    if (isSeasonLocked(events)) {
      throw new AppError(403, 'SEASON_LOCKED', 'Pool modifications are locked -- all events have been completed');
    }
    if (options?.phaseLabel !== undefined) {
      assertOwnerPhaseAllowed(options.phaseLabel, events);
    }
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

async function assertCanViewPool(poolId: string, viewer?: { id: string; role: 'admin' | 'user' } | null) {
  const pool = await getPoolDetail(poolId);
  const season = await prisma.season.findUnique({
    where: { id: pool.seasonId },
    select: {
      poolVisibility: true,
      decklistVisibility: true,
      scheduleVisibility: true,
    },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }
  if (!canViewPool(pool, season, viewer ?? null)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this pool');
  }
  return pool;
}

router.get('/:poolId', optionalAuth, async (req, res, next) => {
  try {
    const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
    const pool = await assertCanViewPool(req.params.poolId, viewer);
    const acquisitions = await listAcquisitions(req.params.poolId);
    res.json({ data: { pool, acquisitions } });
  } catch (error) {
    next(error);
  }
});

router.get('/:poolId/export/decklist', optionalAuth, async (req, res, next) => {
  try {
    const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
    const pool = await assertCanViewPool(req.params.poolId, viewer);
    const acquisitions = await listAcquisitions(req.params.poolId);

    const flattenedEntries = acquisitions.flatMap((acquisition) =>
      acquisition.entries.map((entry) => ({
        quantity: entry.quantity,
        cachedCard: entry.cachedCard,
      })),
    );
    const deckText = buildPoolDecklistExport(flattenedEntries).join('\n');

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
      await assertCanModifyPool(req.params.poolId, req.user!.id, req.user!.role, {
        phaseLabel: req.body.phaseLabel,
      });
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
      const result = await bulkResolveAcquisitionItems(req.body.items, setCodes);
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
      await assertCanModifyPool(req.params.poolId, req.user!.id, req.user!.role, {
        phaseLabel: req.body.phaseLabel,
      });
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
