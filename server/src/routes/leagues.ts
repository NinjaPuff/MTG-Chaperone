import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import {
  addMember,
  createLeague,
  deleteLeague,
  getLeagueBySlug,
  getMembers,
  listLeagues,
  removeMember,
  updateLeague,
} from '../services/leagueService.js';
import { createSeason, listSeasonsByLeague, setActive, updateSeason } from '../services/seasonService.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createInvite, listInvites, revokeInvite, validateAndJoin } from '../services/inviteService.js';

const router = Router();

const leagueSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().nullish(),
  logoUrl: z.string().url().nullish(),
  bannerUrl: z.string().url().nullish(),
});

const seasonSchema = z.object({
  name: z.string().min(2),
  tradingEnabled: z.boolean().optional(),
  poolVisibility: z.boolean().optional(),
  decklistVisibility: z.boolean().optional(),
  scheduleVisibility: z.boolean().optional(),
  pointConfig: z
    .object({
      matchWinPoints: z.number().int().optional(),
      matchDrawPoints: z.number().int().optional(),
      matchLossPoints: z.number().int().optional(),
      gameWinPoints: z.number().int().optional(),
      sweepBonusPoints: z.number().int().optional(),
    })
    .optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const leagues = await listLeagues();
    res.json({ data: leagues });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, validateBody(leagueSchema), async (req, res, next) => {
  try {
    const league = await createLeague(req.body, req.user!.id);
    res.status(201).json({ data: league });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const league = await getLeagueBySlug(req.params.slug);
    res.json({ data: league });
  } catch (error) {
    next(error);
  }
});

router.patch('/:slug', requireAuth, requireAdmin('slug'), validateBody(leagueSchema.partial()), async (req, res, next) => {
  try {
    const league = await updateLeague(req.params.slug, req.body);
    res.json({ data: league });
  } catch (error) {
    next(error);
  }
});

router.delete('/:slug', requireAuth, requireAdmin('slug'), async (req, res, next) => {
  try {
    await deleteLeague(req.params.slug);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:slug/members', async (req, res, next) => {
  try {
    const members = await getMembers(req.params.slug);
    res.json({ data: members });
  } catch (error) {
    next(error);
  }
});

router.post('/:slug/join', requireAuth, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(6) }).parse(req.body);
    const league = await validateAndJoin(token, req.user!.id);
    res.json({ data: { success: true, league } });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug/invites', requireAuth, requireAdmin('slug'), async (req, res, next) => {
  try {
    const invites = await listInvites(req.params.slug);
    res.json({ data: invites });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:slug/invites',
  requireAuth,
  requireAdmin('slug'),
  validateBody(
    z.object({
      maxUses: z.number().int().positive().nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const invite = await createInvite(req.params.slug, req.user!.id, req.body);
      res.status(201).json({ data: invite });
    } catch (error) {
      next(error);
    }
  },
);

router.delete('/:slug/invites/:id', requireAuth, requireAdmin('slug'), async (req, res, next) => {
  try {
    const invite = await revokeInvite(req.params.slug, req.params.id);
    res.json({ data: invite });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug/seasons', async (req, res, next) => {
  try {
    const league = await prisma.league.findUnique({
      where: { slug: req.params.slug },
      select: { id: true },
    });
    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }
    const seasons = await listSeasonsByLeague(league.id);
    res.json({ data: seasons });
  } catch (error) {
    next(error);
  }
});

router.post('/:slug/seasons', requireAuth, requireAdmin('slug'), validateBody(seasonSchema), async (req, res, next) => {
  try {
    const league = await prisma.league.findUnique({
      where: { slug: req.params.slug },
      select: { id: true },
    });
    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }
    const season = await createSeason(league.id, req.body);
    res.status(201).json({ data: season });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug/seasons/:number', async (req, res, next) => {
  try {
    const seasonNumber = Number(req.params.number);
    const season = await prisma.season.findFirst({
      where: {
        league: { slug: req.params.slug },
        number: seasonNumber,
      },
      include: {
        pointConfig: true,
      },
    });
    if (!season) {
      throw new AppError(404, 'NOT_FOUND', 'Season not found');
    }
    res.json({ data: season });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:slug/seasons/:number',
  requireAuth,
  requireAdmin('slug'),
  validateBody(seasonSchema.partial().extend({ isActive: z.boolean().optional() })),
  async (req, res, next) => {
    try {
      const seasonNumber = Number(req.params.number);
      const season = await prisma.season.findFirst({
        where: {
          league: { slug: req.params.slug },
          number: seasonNumber,
        },
      });
      if (!season) {
        throw new AppError(404, 'NOT_FOUND', 'Season not found');
      }

      if (req.body.isActive) {
        await setActive(season.id);
      }

      const updated = await updateSeason(season.id, req.body);
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  },
);

router.delete('/:slug/members/:userId', requireAuth, requireAdmin('slug'), async (req, res, next) => {
  try {
    await removeMember(req.params.slug, req.params.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as leaguesRouter };
