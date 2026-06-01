import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import {
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
import { createPool, deletePool, listPoolsBySeason, updatePool } from '../services/cardPoolService.js';
import { canViewSeasonPools } from '../lib/visibilityRules.js';

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

const createPoolSchema = z.object({
  userId: z.string().uuid(),
  boosterProductId: z.string().uuid(),
});

const updatePoolSchema = z.object({
  boosterProductId: z.string().uuid(),
});

async function getLeagueIdBySlug(slug: string) {
  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!league) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }
  return league.id;
}

async function getSeasonByLeagueAndNumber(leagueId: string, seasonNumberParam: string) {
  const seasonNumber = Number(seasonNumberParam);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Season number must be a positive integer');
  }

  const season = await prisma.season.findFirst({
    where: {
      leagueId,
      number: seasonNumber,
    },
    select: {
      id: true,
      number: true,
      poolVisibility: true,
      decklistVisibility: true,
      scheduleVisibility: true,
    },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  return season;
}

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

router.get('/:slug/members', async (req, res, next) => {
  try {
    const members = await getMembers(req.params.slug);
    res.json({ data: members });
  } catch (error) {
    next(error);
  }
});

router.delete('/:slug/members/:userId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await removeMember(req.params.slug, req.params.userId);
    res.status(204).send();
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

router.patch('/:slug', requireAuth, requireAdmin, validateBody(leagueSchema.partial()), async (req, res, next) => {
  try {
    const league = await updateLeague(req.params.slug, req.body);
    res.json({ data: league });
  } catch (error) {
    next(error);
  }
});

router.delete('/:slug', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await deleteLeague(req.params.slug);
    res.status(204).send();
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

router.get('/:slug/invites', requireAuth, requireAdmin, async (req, res, next) => {
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
  requireAdmin,
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

router.delete('/:slug/invites/:id', requireAuth, requireAdmin, async (req, res, next) => {
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

router.post('/:slug/seasons', requireAuth, requireAdmin, validateBody(seasonSchema), async (req, res, next) => {
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

router.get('/:slug/seasons/:number/pools', optionalAuth, async (req, res, next) => {
  try {
    const leagueId = await getLeagueIdBySlug(req.params.slug);
    const season = await getSeasonByLeagueAndNumber(leagueId, req.params.number);
    const pools = await listPoolsBySeason(season.id);
    const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;

    if (season.poolVisibility) {
      res.json({ data: pools, meta: { poolVisibility: true } });
      return;
    }

    if (!viewer) {
      res.json({ data: [], meta: { poolVisibility: false } });
      return;
    }

    const filtered = pools.filter(
      (pool) => canViewSeasonPools(season, viewer, pool.userId),
    );
    res.json({ data: filtered, meta: { poolVisibility: false } });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:slug/seasons/:number/pools',
  requireAuth,
  requireAdmin,
  validateBody(createPoolSchema),
  async (req, res, next) => {
    try {
      const leagueId = await getLeagueIdBySlug(req.params.slug);
      const season = await getSeasonByLeagueAndNumber(leagueId, req.params.number);

      const membership = await prisma.leagueMembership.findUnique({
        where: {
          userId_leagueId: {
            userId: req.body.userId,
            leagueId,
          },
        },
        select: { id: true },
      });

      if (!membership) {
        throw new AppError(400, 'VALIDATION_ERROR', 'User is not a member of this league');
      }

      const pool = await createPool(req.body.userId, season.id, req.body.boosterProductId);
      res.status(201).json({ data: pool });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:slug/seasons/:number/pools/:poolId',
  requireAuth,
  requireAdmin,
  validateBody(updatePoolSchema),
  async (req, res, next) => {
    try {
      const leagueId = await getLeagueIdBySlug(req.params.slug);
      const season = await getSeasonByLeagueAndNumber(leagueId, req.params.number);

      const scopedPool = await prisma.cardPool.findFirst({
        where: {
          id: req.params.poolId,
          seasonId: season.id,
        },
        select: { id: true },
      });

      if (!scopedPool) {
        throw new AppError(404, 'NOT_FOUND', 'Card pool not found');
      }

      const pool = await updatePool(scopedPool.id, req.body.boosterProductId);
      res.json({ data: pool });
    } catch (error) {
      next(error);
    }
  },
);

router.delete('/:slug/seasons/:number/pools/:poolId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const leagueId = await getLeagueIdBySlug(req.params.slug);
    const season = await getSeasonByLeagueAndNumber(leagueId, req.params.number);

    const scopedPool = await prisma.cardPool.findFirst({
      where: {
        id: req.params.poolId,
        seasonId: season.id,
      },
      select: { id: true },
    });

    if (!scopedPool) {
      throw new AppError(404, 'NOT_FOUND', 'Card pool not found');
    }

    await deletePool(scopedPool.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:slug/seasons/:number',
  requireAuth,
  requireAdmin,
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

export function createLeaguesRouter() {
  return router;
}

export const leaguesRouter = createLeaguesRouter();
