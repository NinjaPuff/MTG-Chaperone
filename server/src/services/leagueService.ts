import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { slugify, withSlugSuffix } from '../lib/slugify.js';
import { recomputeStandings } from './standingsService.js';
import type { PrismaClient } from '@prisma/client';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';

type LeaguePayload = {
  name: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
};

type LeagueServiceDeps = {
  prisma: PrismaClient;
  recomputeStandings: (seasonId: string) => Promise<unknown>;
  rng: () => number;
  now: () => Date;
};

export function createLeagueService(partialDeps?: Partial<LeagueServiceDeps>) {
  const deps: LeagueServiceDeps = {
    prisma,
    recomputeStandings,
    rng: () => Math.random(),
    now: () => new Date(),
    ...partialDeps,
  };

  async function uniqueLeagueSlug(seed: string) {
    const base = slugify(seed);
    let candidate = base;

    for (let i = 0; i < 5; i += 1) {
      const existing = await deps.prisma.league.findUnique({ where: { slug: candidate } });
      if (!existing) {
        return candidate;
      }
      candidate = withSlugSuffix(base, deps.rng().toString(36).slice(2, 8));
    }

    return withSlugSuffix(base, deps.now().getTime().toString());
  }

  async function recomputeActiveSeasonStandingsForLeague(leagueId: string) {
    const seasons = await deps.prisma.season.findMany({
      where: {
        leagueId,
        isActive: true,
      },
      select: {
        id: true,
        pointConfig: {
          select: { id: true },
        },
      },
    });

    for (const season of seasons) {
      if (!season.pointConfig) {
        continue;
      }
      await deps.recomputeStandings(season.id);
    }
  }

  async function listLeagues() {
    return deps.prisma.league.findMany({
      include: {
        seasons: {
          where: { isActive: true },
          take: 1,
          orderBy: { number: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function createLeague(payload: LeaguePayload, userId: string) {
    const slug = await uniqueLeagueSlug(payload.slug || payload.name);

    return deps.prisma.league.create({
      data: {
        name: payload.name,
        slug,
        description: payload.description ?? null,
        logoUrl: payload.logoUrl ?? null,
        bannerUrl: payload.bannerUrl ?? null,
        memberships: {
          create: {
            userId,
          },
        },
      },
    });
  }

  async function getLeagueBySlug(slug: string) {
    const league = await deps.prisma.league.findUnique({
      where: { slug },
      include: {
        seasons: {
          orderBy: { number: 'desc' },
          include: {
            pointConfig: true,
          },
        },
      },
    });

    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    return league;
  }

  async function updateLeague(slug: string, payload: LeaguePayload) {
    const existing = await deps.prisma.league.findUnique({ where: { slug } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    const updateSlug = payload.slug && payload.slug !== existing.slug
      ? await uniqueLeagueSlug(payload.slug)
      : existing.slug;

    return deps.prisma.league.update({
      where: { id: existing.id },
      data: {
        name: payload.name ?? existing.name,
        slug: updateSlug,
        description: payload.description ?? existing.description,
        logoUrl: payload.logoUrl ?? existing.logoUrl,
        bannerUrl: payload.bannerUrl ?? existing.bannerUrl,
      },
    });
  }

  async function deleteLeague(slug: string) {
    const existing = await deps.prisma.league.findUnique({ where: { slug } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    await deps.prisma.league.delete({ where: { id: existing.id } });
  }

  async function getMembers(slug: string) {
    const league = await deps.prisma.league.findUnique({ where: { slug }, select: { id: true } });
    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    return deps.prisma.leagueMembership.findMany({
      where: { leagueId: league.id },
      select: {
        id: true,
        userId: true,
        leagueId: true,
        joinedAt: true,
        user: {
          select: USER_PUBLIC_SELECT,
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async function addMember(slug: string, userId: string) {
    const league = await deps.prisma.league.findUnique({ where: { slug }, select: { id: true } });
    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    const membership = await deps.prisma.leagueMembership.upsert({
      where: {
        userId_leagueId: {
          userId,
          leagueId: league.id,
        },
      },
      update: {},
      create: {
        userId,
        leagueId: league.id,
      },
    });

    await recomputeActiveSeasonStandingsForLeague(league.id);
    return membership;
  }

  async function removeMember(slug: string, userId: string) {
    const league = await deps.prisma.league.findUnique({ where: { slug }, select: { id: true } });
    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    const membership = await deps.prisma.leagueMembership.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: league.id,
        },
      },
    });

    if (!membership) {
      throw new AppError(404, 'NOT_FOUND', 'Member not found');
    }

    await deps.prisma.$transaction(async (tx) => {
      await tx.cardPool.deleteMany({
        where: {
          userId,
          season: {
            leagueId: league.id,
          },
        },
      });

      await tx.leagueMembership.delete({ where: { id: membership.id } });
    });

    await recomputeActiveSeasonStandingsForLeague(league.id);
  }

  return {
    listLeagues,
    createLeague,
    getLeagueBySlug,
    updateLeague,
    deleteLeague,
    getMembers,
    addMember,
    removeMember,
  };
}

const defaultLeagueService = createLeagueService();
export const listLeagues = defaultLeagueService.listLeagues;
export const createLeague = defaultLeagueService.createLeague;
export const getLeagueBySlug = defaultLeagueService.getLeagueBySlug;
export const updateLeague = defaultLeagueService.updateLeague;
export const deleteLeague = defaultLeagueService.deleteLeague;
export const getMembers = defaultLeagueService.getMembers;
export const addMember = defaultLeagueService.addMember;
export const removeMember = defaultLeagueService.removeMember;
