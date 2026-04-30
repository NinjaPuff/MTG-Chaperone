import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { completeRound, regenerateRoundPairings, startRound } from '../services/roundService.js';

const router = Router();

async function ensureRoundAdmin(roundId: string, userId: string) {
  const membership = await prisma.leagueMembership.findFirst({
    where: {
      userId,
      role: 'admin',
      league: {
        seasons: {
          some: {
            events: {
              some: {
                rounds: {
                  some: { id: roundId },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
}

router.get('/:roundId', async (req, res, next) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        matches: {
          include: {
            player1: { select: { id: true, displayName: true, slug: true } },
            player2: { select: { id: true, displayName: true, slug: true } },
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

router.post('/:roundId/start', requireAuth, async (req, res, next) => {
  try {
    await ensureRoundAdmin(req.params.roundId, req.user!.id);
    const round = await startRound(req.params.roundId);
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.post('/:roundId/complete', requireAuth, async (req, res, next) => {
  try {
    await ensureRoundAdmin(req.params.roundId, req.user!.id);
    const round = await completeRound(req.params.roundId);
    res.json({ data: round });
  } catch (error) {
    next(error);
  }
});

router.post('/:roundId/regenerate', requireAuth, async (req, res, next) => {
  try {
    await ensureRoundAdmin(req.params.roundId, req.user!.id);
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

router.get('/:roundId/matches', async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { roundId: req.params.roundId },
      include: {
        player1: { select: { id: true, displayName: true, slug: true } },
        player2: { select: { id: true, displayName: true, slug: true } },
        gameResults: true,
      },
    });
    res.json({ data: matches });
  } catch (error) {
    next(error);
  }
});

export { router as roundsRouter };
