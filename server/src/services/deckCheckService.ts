import { prisma } from '../lib/prisma.js';
import { USER_PUBLIC_SELECT } from '../lib/userSelect.js';
import { isPublicDecklistStatus } from '../lib/visibilityRules.js';
import { AppError } from '../middleware/errorHandler.js';
import { selectDeckbuilderRound } from './decklistService.js';

type EmptyReason = 'no_active_season' | 'no_current_event' | 'no_current_round';

const seasonDeckCheckInclude = {
  events: {
    orderBy: { orderIndex: 'asc' as const },
    include: {
      config: {
        select: {
          deckCount: true,
        },
      },
      rounds: {
        orderBy: { roundNumber: 'asc' as const },
        select: {
          id: true,
          roundNumber: true,
          status: true,
        },
      },
    },
  },
} as const;

const decklistInclude = {
  user: {
    select: USER_PUBLIC_SELECT,
  },
  event: {
    select: {
      id: true,
      name: true,
      status: true,
      orderIndex: true,
    },
  },
  round: {
    select: {
      id: true,
      roundNumber: true,
      status: true,
    },
  },
  entries: {
    include: {
      cachedCard: {
        select: {
          scryfallId: true,
          name: true,
          layout: true,
          manaCost: true,
          typeLine: true,
          cmc: true,
          colorIdentity: true,
          setCode: true,
          collectorNumber: true,
        },
      },
    },
  },
} as const;

function requiredDeckCount(config: { deckCount: number } | null | undefined) {
  return Math.max(1, config?.deckCount ?? 1);
}

function primaryName(user: { publicName: string | null; displayName: string }) {
  return user.publicName || user.displayName;
}

function emptyPayload(
  emptyReason: EmptyReason,
  fields?: {
    season?: { id: string; name: string; decklistVisibility: boolean } | null;
    event?: { id: string; name: string; status: string } | null;
    deckCount?: number | null;
  },
) {
  return {
    emptyReason,
    season: fields?.season ?? null,
    event: fields?.event ?? null,
    round: null,
    deckCount: fields?.deckCount ?? null,
    decklists: [] as never[],
    players: [] as never[],
  };
}

function pickCurrentEvent<T extends { status: string }>(events: T[]) {
  return events.find((event) => event.status === 'active') ?? events.find((event) => event.status === 'setup') ?? null;
}

export async function getAdminDeckChecks(seasonId?: string) {
  const season =
    seasonId !== undefined
      ? await prisma.season.findUnique({
          where: { id: seasonId },
          include: seasonDeckCheckInclude,
        })
      : await prisma.season.findFirst({
          where: { isActive: true },
          orderBy: { number: 'desc' },
          include: seasonDeckCheckInclude,
        });

  if (!season) {
    if (seasonId !== undefined) {
      throw new AppError(404, 'NOT_FOUND', 'Season not found');
    }
    return emptyPayload('no_active_season');
  }

  const seasonSummary = {
    id: season.id,
    name: season.name,
    decklistVisibility: season.decklistVisibility,
  };

  const currentEvent = pickCurrentEvent(season.events);
  if (!currentEvent) {
    return emptyPayload('no_current_event', { season: seasonSummary });
  }

  const eventSummary = {
    id: currentEvent.id,
    name: currentEvent.name,
    status: currentEvent.status,
  };
  const deckCount = requiredDeckCount(currentEvent.config);
  const selectedRound = selectDeckbuilderRound(currentEvent.rounds);
  if (!selectedRound) {
    return emptyPayload('no_current_round', {
      season: seasonSummary,
      event: eventSummary,
      deckCount,
    });
  }

  const memberships = await prisma.leagueMembership.findMany({
    where: { leagueId: season.leagueId },
    select: {
      userId: true,
      user: { select: USER_PUBLIC_SELECT },
    },
  });
  const memberIds = memberships.map((membership) => membership.userId);
  const drops =
    memberIds.length === 0
      ? []
      : await prisma.playerDrop.findMany({
          where: {
            seasonId: season.id,
            userId: { in: memberIds },
            OR: [{ eventId: currentEvent.id }, { eventId: null }],
          },
          select: { userId: true },
        });
  const droppedIds = new Set(drops.map((drop) => drop.userId));
  const roster = memberships.filter((membership) => !droppedIds.has(membership.userId));
  const rosterIds = new Set(roster.map((membership) => membership.userId));

  const decklists = await prisma.decklist.findMany({
    where: {
      eventId: currentEvent.id,
    },
    include: decklistInclude,
    orderBy: { orderIndex: 'asc' },
  });

  const officialDecklists = decklists.filter(
    (decklist) =>
      rosterIds.has(decklist.userId) &&
      isPublicDecklistStatus(decklist.status) &&
      decklist.orderIndex < deckCount,
  );

  const registeredCountByUser = new Map<string, number>();
  for (const decklist of officialDecklists) {
    registeredCountByUser.set(decklist.userId, (registeredCountByUser.get(decklist.userId) ?? 0) + 1);
  }

  const players = [...roster]
    .sort((a, b) => primaryName(a.user).localeCompare(primaryName(b.user)))
    .map((membership) => ({
      user: membership.user,
      registeredCount: registeredCountByUser.get(membership.userId) ?? 0,
      requiredCount: deckCount,
    }));

  return {
    emptyReason: null,
    season: seasonSummary,
    event: eventSummary,
    round: {
      id: selectedRound.id,
      roundNumber: selectedRound.roundNumber,
      status: selectedRound.status,
    },
    deckCount,
    decklists: officialDecklists,
    players,
  };
}
