import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { confirmMatch, disputeMatch, reportMatch, resolveMatch, updateMatchPlayers } from '../services/matchService.js';
import { prisma } from '../lib/prisma.js';
import { recomputeStandings } from '../services/standingsService.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';

const router = Router();

const matchResultsSchema = z.object({
  gameResults: z.array(
    z.object({
      winnerId: z.string().uuid().nullable().optional(),
      isDraw: z.boolean().optional(),
      notes: z.string().optional(),
    }),
  ).min(1),
});

const updateMatchPlayersSchema = z.object({
  player1Id: z.string().uuid().optional(),
  player2Id: z.string().uuid().nullable().optional(),
}).refine(
  (data) => data.player1Id !== undefined || data.player2Id !== undefined,
  { message: 'At least one of player1Id or player2Id must be provided' },
);

router.get('/:matchId', async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: {
        player1: { select: USER_PUBLIC_SELECT },
        player2: { select: USER_PUBLIC_SELECT },
        gameResults: true,
        round: {
          include: {
            event: true,
          },
        },
      },
    });
    res.json({ data: match });
  } catch (error) {
    next(error);
  }
});

router.post('/:matchId/report', requireAuth, validateBody(matchResultsSchema), async (req, res, next) => {
  try {
    const match = await reportMatch(req.params.matchId, req.user!.id, req.body.gameResults);
    res.json({ data: match });
  } catch (error) {
    next(error);
  }
});

router.post('/:matchId/confirm', requireAuth, async (req, res, next) => {
  try {
    const match = await confirmMatch(req.params.matchId, req.user!.id);
    const matchSeason = await prisma.match.findUnique({
      where: { id: match.id },
      include: { round: { include: { event: true } } },
    });
    if (matchSeason) {
      await recomputeStandings(matchSeason.round.event.seasonId);
    }
    res.json({ data: match });
  } catch (error) {
    next(error);
  }
});

router.post('/:matchId/dispute', requireAuth, async (req, res, next) => {
  try {
    const match = await disputeMatch(req.params.matchId, req.user!.id);
    res.json({ data: match });
  } catch (error) {
    next(error);
  }
});

router.post('/:matchId/resolve', requireAuth, validateBody(matchResultsSchema), async (req, res, next) => {
  try {
    const match = await resolveMatch(req.params.matchId, req.user!.id, req.body.gameResults);
    const matchSeason = await prisma.match.findUnique({
      where: { id: match.id },
      include: { round: { include: { event: true } } },
    });
    if (matchSeason) {
      await recomputeStandings(matchSeason.round.event.seasonId);
    }
    res.json({ data: match });
  } catch (error) {
    next(error);
  }
});

router.patch('/:matchId/players', requireAuth, requireAdmin, validateBody(updateMatchPlayersSchema), async (req, res, next) => {
  try {
    const match = await updateMatchPlayers(req.params.matchId, req.body);
    const fullMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: {
        player1: { select: USER_PUBLIC_SELECT },
        player2: { select: USER_PUBLIC_SELECT },
        gameResults: true,
        round: {
          include: {
            event: true,
          },
        },
      },
    });
    res.json({ data: fullMatch });
  } catch (error) {
    next(error);
  }
});

export function createMatchesRouter() {
  return router;
}

export const matchesRouter = createMatchesRouter();
