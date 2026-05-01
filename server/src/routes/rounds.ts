import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { recomputeStandings } from '../services/standingsService.js';
import { completeRound, deleteRound, regenerateRoundPairings, startRound } from '../services/roundService.js';

const router = Router();

router.get('/:roundId', async (req, res, next) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        matches: {
          include: {
            player1: { select: { id: true, displayName: true, publicName: true, slug: true } },
            player2: { select: { id: true, displayName: true, publicName: true, slug: true } },
            gameResults: true,
          },
        },
      },
    });
    if (!round) {
      throw new AppError(404, 'NOT_FOUND', 'Round not found');
    }
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.post('/:roundId/start', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const round = await startRound(req.params.roundId);
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.post('/:roundId/complete', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const round = await completeRound(req.params.roundId);
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.post('/:roundId/regenerate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await regenerateRoundPairings(req.params.roundId);
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: { matches: true },
    });
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.delete('/:roundId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { seasonId } = await deleteRound(req.params.roundId);
    await recomputeStandings(seasonId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:roundId/matches', async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { roundId: req.params.roundId },
      include: {
        player1: { select: { id: true, displayName: true, publicName: true, slug: true } },
        player2: { select: { id: true, displayName: true, publicName: true, slug: true } },
        gameResults: true,
      },
    });
    res.json({ data: matches });
  } catch (error) {
    next(error);
  }
});

export { router as roundsRouter };
