import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type SeasonPayload = {
  name: string;
  tradingEnabled?: boolean;
  poolVisibility?: boolean;
  decklistVisibility?: boolean;
  scheduleVisibility?: boolean;
  pointConfig?: {
    matchWinPoints?: number;
    matchDrawPoints?: number;
    matchLossPoints?: number;
    gameWinPoints?: number;
    sweepBonusPoints?: number;
  };
};

export async function listSeasonsByLeague(leagueId: string) {
  return prisma.season.findMany({
    where: { leagueId },
    include: {
      pointConfig: true,
    },
    orderBy: { number: 'desc' },
  });
}

export async function createSeason(leagueId: string, payload: SeasonPayload) {
  const lastSeason = await prisma.season.findFirst({
    where: { leagueId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const seasonNumber = (lastSeason?.number || 0) + 1;

  return prisma.season.create({
    data: {
      leagueId,
      name: payload.name,
      number: seasonNumber,
      tradingEnabled: payload.tradingEnabled ?? false,
      isActive: lastSeason ? false : true,
      poolVisibility: payload.poolVisibility ?? true,
      decklistVisibility: payload.decklistVisibility ?? true,
      scheduleVisibility: payload.scheduleVisibility ?? true,
      pointConfig: {
        create: {
          matchWinPoints: payload.pointConfig?.matchWinPoints ?? 3,
          matchDrawPoints: payload.pointConfig?.matchDrawPoints ?? 1,
          matchLossPoints: payload.pointConfig?.matchLossPoints ?? 0,
          gameWinPoints: payload.pointConfig?.gameWinPoints ?? 0,
          sweepBonusPoints: payload.pointConfig?.sweepBonusPoints ?? 0,
        },
      },
    },
    include: {
      pointConfig: true,
    },
  });
}

export async function getSeason(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      pointConfig: true,
      events: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  return season;
}

export async function updateSeason(seasonId: string, payload: SeasonPayload) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { pointConfig: true },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  const updated = await prisma.season.update({
    where: { id: season.id },
    data: {
      name: payload.name ?? season.name,
      tradingEnabled: payload.tradingEnabled ?? season.tradingEnabled,
      poolVisibility: payload.poolVisibility ?? season.poolVisibility,
      decklistVisibility: payload.decklistVisibility ?? season.decklistVisibility,
      scheduleVisibility: payload.scheduleVisibility ?? season.scheduleVisibility,
    },
  });

  if (payload.pointConfig) {
    await prisma.pointConfig.update({
      where: { seasonId: season.id },
      data: {
        matchWinPoints: payload.pointConfig.matchWinPoints ?? season.pointConfig?.matchWinPoints ?? 3,
        matchDrawPoints: payload.pointConfig.matchDrawPoints ?? season.pointConfig?.matchDrawPoints ?? 1,
        matchLossPoints: payload.pointConfig.matchLossPoints ?? season.pointConfig?.matchLossPoints ?? 0,
        gameWinPoints: payload.pointConfig.gameWinPoints ?? season.pointConfig?.gameWinPoints ?? 0,
        sweepBonusPoints: payload.pointConfig.sweepBonusPoints ?? season.pointConfig?.sweepBonusPoints ?? 0,
      },
    });
  }

  return prisma.season.findUnique({
    where: { id: updated.id },
    include: { pointConfig: true },
  });
}

export async function setActive(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  const hasActiveEvents = await prisma.event.findFirst({
    where: {
      season: { leagueId: season.leagueId, isActive: true },
      status: 'active',
    },
    select: { id: true },
  });

  if (hasActiveEvents) {
    throw new AppError(409, 'SEASON_HAS_ACTIVE_EVENT', 'Cannot change active season while an event is active');
  }

  await prisma.$transaction([
    prisma.season.updateMany({
      where: { leagueId: season.leagueId, isActive: true },
      data: { isActive: false },
    }),
    prisma.season.update({
      where: { id: season.id },
      data: { isActive: true },
    }),
  ]);
}
