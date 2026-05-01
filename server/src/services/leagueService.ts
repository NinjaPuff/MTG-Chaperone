import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { slugify, withSlugSuffix } from '../lib/slugify.js';

type LeaguePayload = {
  name: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
};

async function uniqueLeagueSlug(seed: string) {
  const base = slugify(seed);
  let candidate = base;

  for (let i = 0; i < 5; i += 1) {
    const existing = await prisma.league.findUnique({ where: { slug: candidate } });
    if (!existing) {
      return candidate;
    }
    candidate = withSlugSuffix(base, Math.random().toString(36).slice(2, 8));
  }

  return withSlugSuffix(base, Date.now().toString());
}

export async function listLeagues() {
  return prisma.league.findMany({
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

export async function createLeague(payload: LeaguePayload, userId: string) {
  const slug = await uniqueLeagueSlug(payload.slug || payload.name);

  return prisma.league.create({
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

export async function getLeagueBySlug(slug: string) {
  const league = await prisma.league.findUnique({
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

export async function updateLeague(slug: string, payload: LeaguePayload) {
  const existing = await prisma.league.findUnique({ where: { slug } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  const updateSlug = payload.slug && payload.slug !== existing.slug
    ? await uniqueLeagueSlug(payload.slug)
    : existing.slug;

  return prisma.league.update({
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

export async function deleteLeague(slug: string) {
  const existing = await prisma.league.findUnique({ where: { slug } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  await prisma.league.delete({ where: { id: existing.id } });
}

export async function getMembers(slug: string) {
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true } });
  if (!league) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  return prisma.leagueMembership.findMany({
    where: { leagueId: league.id },
    select: {
      id: true,
      userId: true,
      leagueId: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          displayName: true,
          publicName: true,
          slug: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function addMember(slug: string, userId: string) {
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true } });
  if (!league) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  return prisma.leagueMembership.upsert({
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
}

export async function removeMember(slug: string, userId: string) {
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true } });
  if (!league) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  const membership = await prisma.leagueMembership.findUnique({
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

  await prisma.$transaction(async (tx) => {
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
}
