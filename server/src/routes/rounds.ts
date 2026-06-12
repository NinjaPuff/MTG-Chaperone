import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { recomputeStandings } from '../services/standingsService.js';
import { completeRound, deleteRound, regenerateRoundPairings, resetRound, startRound } from '../services/roundService.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';

const router = Router();

router.get('/:roundId', async (req, res, next) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        matches: {
          include: {
            player1: { select: USER_PUBLIC_SELECT },
            player2: { select: USER_PUBLIC_SELECT },
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
    const roundMeta = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      select: {
        event: {
          select: { seasonId: true },
        },
      },
    });
    if (!roundMeta) {
      throw new AppError(404, 'NOT_FOUND', 'Round not found');
    }
    const round = await completeRound(req.params.roundId);
    await recomputeStandings(roundMeta.event.seasonId);
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.post('/:roundId/regenerate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const roundMeta = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      select: {
        event: {
          select: { seasonId: true },
        },
      },
    });
    if (!roundMeta) {
      throw new AppError(404, 'NOT_FOUND', 'Round not found');
    }

    await regenerateRoundPairings(req.params.roundId);
    await recomputeStandings(roundMeta.event.seasonId);

    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: { matches: true },
    });
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.post('/:roundId/reset', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const roundMeta = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      select: {
        event: {
          select: { seasonId: true },
        },
      },
    });
    if (!roundMeta) {
      throw new AppError(404, 'NOT_FOUND', 'Round not found');
    }

    const round = await resetRound(req.params.roundId);
    await recomputeStandings(roundMeta.event.seasonId);
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
        player1: { select: USER_PUBLIC_SELECT },
        player2: { select: USER_PUBLIC_SELECT },
        gameResults: true,
      },
    });
    res.json({ data: matches });
  } catch (error) {
    next(error);
  }
});

export function createRoundsRouter() {
  return router;
}

export const roundsRouter = createRoundsRouter();
