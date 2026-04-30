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

export async function getEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      config: true,
      rounds: {
        orderBy: { roundNumber: 'asc' },
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
