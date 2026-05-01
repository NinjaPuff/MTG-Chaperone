import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type EventConfigInput = {
  format: 'swiss' | 'seeded_swiss' | 'round_robin';
  bestOfN?: number;
  deckCount?: number;
  minDeckSize?: number;
  sideboardRule?: 'entire_pool' | 'fixed_15' | 'none';
  schedulingType?: 'fixed_deadlines' | 'open_window' | 'weekly_auto';
  deckLockingMode?: 'required_before_round' | 'free_modification' | 'admin_locked';
  seedingSource?: 'previous_season' | 'previous_event' | 'manual' | null;
};

type CreateEventInput = {
  seasonId: string;
  name: string;
  pointMultiplier?: number;
  standingsOverride?: boolean;
  config: EventConfigInput;
};

type CreateRoundRobinSeriesInput = {
  seasonId: string;
  baseName: string;
  roundsPerEvent: number;
  pointMultiplier?: number;
  standingsOverride?: boolean;
};

type RoundRobinPair = { player1Id: string; player2Id: string | null; isBye: boolean };

function buildRoundRobinPairs(playerIds: string[]): RoundRobinPair[][] {
  const participants = [...playerIds];
  if (participants.length === 0) {
    return [];
  }

  if (participants.length % 2 === 1) {
    participants.push('BYE');
  }

  const totalRounds = participants.length - 1;
  const half = participants.length / 2;
  const rotation = [...participants];
  const rounds: RoundRobinPair[][] = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const pairs: RoundRobinPair[] = [];
    for (let index = 0; index < half; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      if (left === 'BYE' || right === 'BYE') {
        const byePlayer = left === 'BYE' ? right : left;
        if (byePlayer !== 'BYE') {
          pairs.push({
            player1Id: byePlayer,
            player2Id: null,
            isBye: true,
          });
        }
      } else {
        pairs.push({
          player1Id: left,
          player2Id: right,
          isBye: false,
        });
      }
    }

    rounds.push(pairs);
    rotation.splice(1, 0, rotation.pop()!);
  }

  return rounds;
}

function buildRandomRoundPairs(playerIds: string[]): RoundRobinPair[] {
  const shuffled = [...playerIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return pairPlayers(shuffled);
}

function pairPlayers(playerIds: string[]): RoundRobinPair[] {
  const pairs: RoundRobinPair[] = [];
  const queue = [...playerIds];
  while (queue.length >= 2) {
    const player1Id = queue.shift()!;
    const player2Id = queue.shift()!;
    pairs.push({ player1Id, player2Id, isBye: false });
  }
  if (queue.length === 1) {
    pairs.push({ player1Id: queue[0], player2Id: null, isBye: true });
  }
  return pairs;
}

export async function createEvent(payload: CreateEventInput) {
  const season = await prisma.season.findUnique({
    where: { id: payload.seasonId },
    select: { id: true },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  const lastEvent = await prisma.event.findFirst({
    where: { seasonId: payload.seasonId },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  });

  return prisma.event.create({
    data: {
      seasonId: payload.seasonId,
      name: payload.name,
      pointMultiplier: payload.pointMultiplier ?? 1,
      standingsOverride: payload.standingsOverride ?? false,
      orderIndex: (lastEvent?.orderIndex || 0) + 1,
      config: {
        create: {
          format: payload.config.format,
          bestOfN: payload.config.bestOfN ?? 3,
          deckCount: payload.config.deckCount ?? 1,
          minDeckSize: payload.config.minDeckSize ?? 40,
          sideboardRule: payload.config.sideboardRule ?? 'entire_pool',
          schedulingType: payload.config.schedulingType ?? 'open_window',
          deckLockingMode: payload.config.deckLockingMode ?? 'free_modification',
          seedingSource: payload.config.seedingSource ?? null,
        },
      },
    },
    include: { config: true },
  });
}

export async function createRoundRobinEventSeries(payload: CreateRoundRobinSeriesInput) {
  const season = await prisma.season.findUnique({
    where: { id: payload.seasonId },
    include: {
      league: {
        include: {
          memberships: {
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  const playerIds = season.league.memberships.map((membership) => membership.userId);
  if (playerIds.length < 2) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least 2 league members are required for round robin');
  }

  const roundsTemplate = buildRoundRobinPairs(playerIds);
  const roundsPerEvent = Math.max(1, payload.roundsPerEvent);
  const pairedRoundsNeeded = Math.max(1, playerIds.length - 1);
  const eventCount = Math.ceil(pairedRoundsNeeded / roundsPerEvent);
  const totalRoundsToCreate = eventCount * roundsPerEvent;

  const allRoundTemplates: RoundRobinPair[][] = roundsTemplate.slice(0, pairedRoundsNeeded);
  while (allRoundTemplates.length < totalRoundsToCreate) {
    allRoundTemplates.push(buildRandomRoundPairs(playerIds));
  }

  const createdEvents: Awaited<ReturnType<typeof createEvent>>[] = [];

  for (let eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
    const event = await createEvent({
      seasonId: payload.seasonId,
      name: `${payload.baseName.trim()} ${eventIndex + 1}/${eventCount}`,
      pointMultiplier: payload.pointMultiplier ?? 1,
      standingsOverride: payload.standingsOverride ?? false,
      config: {
        format: 'round_robin',
        bestOfN: 3,
        deckCount: 1,
        minDeckSize: 40,
        sideboardRule: 'entire_pool',
        schedulingType: 'open_window',
        deckLockingMode: 'free_modification',
        seedingSource: null,
      },
    });

    await prisma.$transaction(async (tx) => {
      for (let roundIndex = 0; roundIndex < roundsPerEvent; roundIndex += 1) {
        const roundTemplate = allRoundTemplates[eventIndex * roundsPerEvent + roundIndex];
        const round = await tx.round.create({
          data: {
            eventId: event.id,
            roundNumber: roundIndex + 1,
            status: 'not_started',
          },
        });

        for (const pair of roundTemplate) {
          await tx.match.create({
            data: {
              roundId: round.id,
              player1Id: pair.player1Id,
              player2Id: pair.player2Id,
              isBye: pair.isBye,
              status: pair.isBye ? 'confirmed' : 'pending',
              confirmedAt: pair.isBye ? new Date() : null,
            },
          });
        }
      }
    });

    createdEvents.push(await getEvent(event.id));
  }

  return createdEvents;
}

export async function getEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      config: true,
      rounds: {
        orderBy: { roundNumber: 'asc' },
      },
      season: {
        select: {
          id: true,
          league: {
            select: {
              id: true,
              slug: true,
              memberships: {
                select: {
                  userId: true,
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
              },
            },
          },
        },
      },
    },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  return event;
}

export async function updateEvent(eventId: string, updates: Partial<CreateEventInput>) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { config: true },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  await prisma.event.update({
    where: { id: eventId },
    data: {
      name: updates.name ?? event.name,
      pointMultiplier: updates.pointMultiplier ?? event.pointMultiplier,
      standingsOverride: updates.standingsOverride ?? event.standingsOverride,
    },
  });

  if (updates.config && event.config) {
    await prisma.eventConfig.update({
      where: { eventId },
      data: {
        format: updates.config.format ?? event.config.format,
        bestOfN: updates.config.bestOfN ?? event.config.bestOfN,
        deckCount: updates.config.deckCount ?? event.config.deckCount,
        minDeckSize: updates.config.minDeckSize ?? event.config.minDeckSize,
        sideboardRule: updates.config.sideboardRule ?? event.config.sideboardRule,
        schedulingType: updates.config.schedulingType ?? event.config.schedulingType,
        deckLockingMode: updates.config.deckLockingMode ?? event.config.deckLockingMode,
        seedingSource: updates.config.seedingSource ?? event.config.seedingSource,
      },
    });
  }

  return getEvent(eventId);
}

export async function startEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { season: true },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  if (event.status !== 'setup') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Only setup events can be started');
  }

  const activeEvent = await prisma.event.findFirst({
    where: {
      seasonId: event.seasonId,
      status: 'active',
      id: { not: event.id },
    },
  });
  if (activeEvent) {
    throw new AppError(409, 'ACTIVE_EVENT_EXISTS', 'Only one active event is allowed per season');
  }

  return prisma.event.update({
    where: { id: event.id },
    data: { status: 'active' },
    include: { config: true },
  });
}

export async function completeEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { rounds: true },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  if (event.status !== 'active') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Only active events can be completed');
  }

  const unresolvedRound = event.rounds.find((round) => round.status !== 'completed');
  if (unresolvedRound) {
    throw new AppError(409, 'ROUND_INCOMPLETE', 'All rounds must be completed first');
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { status: 'completed' },
    include: { config: true },
  });
}
