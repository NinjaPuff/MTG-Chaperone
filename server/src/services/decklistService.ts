import type { DeckZone, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { isDecklistVisibleToViewer } from '../lib/visibilityRules.js';

export const BASIC_LAND_CATALOG_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

type ConstraintType = 'no_repeat_previous' | 'minimum_changes' | 'cumulative_ban';

type PriorRoundEntry = {
  roundNumber: number;
  cachedCardId: string;
  quantity: number;
  typeLine: string;
};

type RestrictedCard = {
  restrictedQty: number;
  reason: string;
};

type DeckEntryInput = {
  cachedCardId: string;
  quantity: number;
  zone: DeckZone;
};

type CombinedAllocationViolation = {
  cachedCardId: string;
  allowed: number;
  allocated: number;
};

type ViolationCardMeta = {
  name: string;
  setCode: string;
  collectorNumber: string | null;
};

type MinimumChangesInput = {
  minChanges: number;
  previousCardIds: Set<string>;
  currentEntries: Array<{ cachedCardId: string; quantity: number; typeLine: string }>;
};

type ComputeRestrictedCopiesInput = {
  constraintType: ConstraintType;
  poolQuantityByCardId: Map<string, number>;
  priorRoundEntries: PriorRoundEntry[];
};

type ValidateCombinedAllocationInput = {
  poolQuantityByCardId: Map<string, number>;
  restrictedQuantityByCardId: Map<string, number>;
  combinedDeckAllocationByCardId: Map<string, number>;
  basicLandCardIds: Set<string>;
};

type FilterWorsenedAllocationInput = {
  previousViolations: CombinedAllocationViolation[];
  nextViolations: CombinedAllocationViolation[];
};

type DecklistValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  invalidCardIds: string[];
};

type DeckbuilderRoundStatus = 'not_started' | 'in_progress' | 'completed';
type DeckbuilderRound = {
  id: string;
  roundNumber: number;
  status: DeckbuilderRoundStatus;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBasicLand(typeLine: string) {
  return /\bBasic\s+Land\b/i.test(typeLine);
}

function aggregateEntries(entries: Array<{ cachedCardId: string; quantity: number }>) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.cachedCardId, (map.get(entry.cachedCardId) ?? 0) + entry.quantity);
  }
  return map;
}

function formatViolationCardLabel(cachedCardId: string, card: ViolationCardMeta | undefined) {
  if (!card) {
    return cachedCardId;
  }

  const setPart = card.collectorNumber ? `${card.setCode} ${card.collectorNumber}` : card.setCode;
  return `${card.name} (${setPart})`;
}

function formatAllocationViolationMessage(
  violation: CombinedAllocationViolation,
  card: ViolationCardMeta | undefined,
) {
  const label = formatViolationCardLabel(violation.cachedCardId, card);
  return `Too many copies allocated for ${label}: ${violation.allocated} allocated, ${violation.allowed} allowed`;
}

function normalizeEntryInputs(entries: DeckEntryInput[]) {
  const next = new Map<string, DeckEntryInput>();

  for (const entry of entries) {
    const cachedCardId = entry.cachedCardId.trim();
    const quantity = Math.floor(entry.quantity);
    if (!cachedCardId || quantity < 1) {
      continue;
    }
    const key = `${cachedCardId}::${entry.zone}`;
    const current = next.get(key);
    if (current) {
      current.quantity += quantity;
    } else {
      next.set(key, { cachedCardId, quantity, zone: entry.zone });
    }
  }

  return [...next.values()];
}

export function computeRestrictedCopies({
  constraintType,
  poolQuantityByCardId,
  priorRoundEntries,
}: ComputeRestrictedCopiesInput) {
  const map = new Map<string, RestrictedCard>();
  if (priorRoundEntries.length === 0 || constraintType === 'minimum_changes') {
    return map;
  }

  const entriesToAggregate =
    constraintType === 'no_repeat_previous'
      ? (() => {
          const latestRound = Math.max(...priorRoundEntries.map((entry) => entry.roundNumber));
          return priorRoundEntries.filter((entry) => entry.roundNumber === latestRound);
        })()
      : priorRoundEntries;

  const usageByCard = new Map<string, number>();
  const roundsByCard = new Map<string, Set<number>>();

  for (const entry of entriesToAggregate) {
    if (isBasicLand(entry.typeLine)) {
      continue;
    }
    usageByCard.set(entry.cachedCardId, (usageByCard.get(entry.cachedCardId) ?? 0) + entry.quantity);
    const roundSet = roundsByCard.get(entry.cachedCardId) ?? new Set<number>();
    roundSet.add(entry.roundNumber);
    roundsByCard.set(entry.cachedCardId, roundSet);
  }

  for (const [cachedCardId, usedQty] of usageByCard.entries()) {
    const poolQty = poolQuantityByCardId.get(cachedCardId) ?? 0;
    if (poolQty < 1) {
      continue;
    }
    const restrictedQty = Math.min(usedQty, poolQty);
    if (restrictedQty < 1) {
      continue;
    }
    const rounds = [...(roundsByCard.get(cachedCardId) ?? new Set<number>())].sort((a, b) => a - b);
    const roundsText = rounds.length === 1 ? `Round ${rounds[0]}` : `Rounds ${rounds.join(', ')}`;
    map.set(cachedCardId, {
      restrictedQty,
      reason: `${restrictedQty} copies played in ${roundsText}`,
    });
  }

  return map;
}

export function computeMinimumChangesShortfall({
  minChanges,
  previousCardIds,
  currentEntries,
}: MinimumChangesInput) {
  if (minChanges < 1) {
    return 0;
  }
  const currentCardIds = new Set<string>();
  for (const entry of currentEntries) {
    if (entry.quantity < 1 || isBasicLand(entry.typeLine)) {
      continue;
    }
    currentCardIds.add(entry.cachedCardId);
  }

  let changedCount = 0;
  for (const cardId of currentCardIds) {
    if (!previousCardIds.has(cardId)) {
      changedCount += 1;
    }
  }

  return Math.max(0, minChanges - changedCount);
}

export function validateCombinedAllocation({
  poolQuantityByCardId,
  restrictedQuantityByCardId,
  combinedDeckAllocationByCardId,
  basicLandCardIds,
}: ValidateCombinedAllocationInput) {
  const violations: CombinedAllocationViolation[] = [];
  for (const [cachedCardId, allocated] of combinedDeckAllocationByCardId.entries()) {
    if (basicLandCardIds.has(cachedCardId)) {
      continue;
    }
    const poolQty = poolQuantityByCardId.get(cachedCardId) ?? 0;
    const restrictedQty = restrictedQuantityByCardId.get(cachedCardId) ?? 0;
    const allowed = Math.max(0, poolQty - restrictedQty);
    if (allocated > allowed) {
      violations.push({ cachedCardId, allowed, allocated });
    }
  }
  return violations;
}

export function filterNewOrWorsenedAllocationViolations({
  previousViolations,
  nextViolations,
}: FilterWorsenedAllocationInput) {
  const previousByCardId = new Map(previousViolations.map((violation) => [violation.cachedCardId, violation]));
  return nextViolations.filter((violation) => {
    const previous = previousByCardId.get(violation.cachedCardId);
    if (!previous) {
      return true;
    }
    return violation.allocated > previous.allocated;
  });
}

async function getEventRoundContext(eventId: string, roundId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      config: true,
      deckUniquenessRule: true,
      season: {
        select: {
          id: true,
        },
      },
      rounds: {
        where: { id: roundId },
        select: {
          id: true,
          roundNumber: true,
        },
      },
    },
  });

  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  const round = event.rounds[0];
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found for event');
  }

  return {
    event,
    round,
  };
}

async function getPoolCardsForUserSeason(userId: string, seasonId: string) {
  const pool = await prisma.cardPool.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId,
      },
    },
    select: {
      id: true,
      acquisitions: {
        select: {
          entries: {
            select: {
              cachedCardId: true,
              quantity: true,
              cachedCard: {
                select: {
                  typeLine: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!pool) {
    throw new AppError(404, 'NOT_FOUND', 'Card pool not found for this season');
  }

  const poolQuantityByCardId = new Map<string, number>();
  const basicLandCardIds = new Set<string>();
  const basicLandCatalog = new Map<
    string,
    { cachedCardId: string; name: string; manaCost: string | null; typeLine: string; colorIdentity: string[] }
  >();

  for (const acquisition of pool.acquisitions) {
    for (const entry of acquisition.entries) {
      poolQuantityByCardId.set(entry.cachedCardId, (poolQuantityByCardId.get(entry.cachedCardId) ?? 0) + entry.quantity);
      if (isBasicLand(entry.cachedCard.typeLine)) {
        basicLandCardIds.add(entry.cachedCardId);
      }
    }
  }

  const basicCards = await prisma.cachedCard.findMany({
    where: {
      OR: BASIC_LAND_CATALOG_NAMES.map((name) => ({ name })),
    },
    select: {
      scryfallId: true,
      name: true,
      manaCost: true,
      typeLine: true,
      colorIdentity: true,
    },
  });

  for (const card of basicCards) {
    basicLandCardIds.add(card.scryfallId);
    basicLandCatalog.set(card.name, {
      cachedCardId: card.scryfallId,
      name: card.name,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      colorIdentity: card.colorIdentity,
    });
  }

  return {
    poolId: pool.id,
    poolQuantityByCardId,
    basicLandCardIds,
    basicLandCatalog,
  };
}

function selectDeckbuilderRound(rounds: DeckbuilderRound[]): DeckbuilderRound | null {
  return (
    rounds.find((round) => round.status === 'in_progress') ??
    rounds.find((round) => round.status === 'not_started') ??
    rounds[rounds.length - 1] ??
    null
  );
}

export async function ensureDeckbuilderRound(eventId: string): Promise<DeckbuilderRound> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      config: {
        select: {
          format: true,
        },
      },
      rounds: {
        select: {
          id: true,
          roundNumber: true,
          status: true,
        },
        orderBy: {
          roundNumber: 'asc',
        },
      },
    },
  });

  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  if (event.status === 'completed') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Event has completed');
  }
  if (event.status !== 'setup' && event.status !== 'active') {
    throw new AppError(409, 'INVALID_EVENT_STATE', `Event is not open for deck registration`);
  }

  const selectedRound = selectDeckbuilderRound(event.rounds as DeckbuilderRound[]);
  if (selectedRound) {
    return selectedRound;
  }

  if (event.config?.format === 'round_robin') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Event has no rounds yet');
  }
  if (event.config?.format !== 'swiss' && event.config?.format !== 'seeded_swiss') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Event has no rounds yet');
  }

  const createdRound = await prisma.round.create({
    data: {
      eventId,
      roundNumber: 1,
      status: 'not_started',
    },
    select: {
      id: true,
      roundNumber: true,
      status: true,
    },
  });

  return createdRound as DeckbuilderRound;
}

function parseMinChanges(parameters: unknown) {
  if (!isObject(parameters)) {
    return 0;
  }
  const maybeMinChanges = parameters.minChanges;
  if (typeof maybeMinChanges !== 'number' || !Number.isFinite(maybeMinChanges)) {
    return 0;
  }
  return Math.max(0, Math.floor(maybeMinChanges));
}

async function getPriorRoundEntries(userId: string, eventId: string, roundNumber: number) {
  const priorDecklists = await prisma.decklist.findMany({
    where: {
      userId,
      eventId,
      status: {
        in: ['submitted', 'locked'],
      },
      round: {
        roundNumber: {
          lt: roundNumber,
        },
      },
    },
    select: {
      orderIndex: true,
      round: {
        select: {
          roundNumber: true,
        },
      },
      entries: {
        select: {
          cachedCardId: true,
          quantity: true,
          cachedCard: {
            select: {
              typeLine: true,
            },
          },
        },
      },
    },
  });

  const priorRoundEntries: PriorRoundEntry[] = [];
  for (const decklist of priorDecklists) {
    for (const entry of decklist.entries) {
      priorRoundEntries.push({
        roundNumber: decklist.round.roundNumber,
        cachedCardId: entry.cachedCardId,
        quantity: entry.quantity,
        typeLine: entry.cachedCard.typeLine,
      });
    }
  }

  return {
    priorDecklists,
    priorRoundEntries,
  };
}

function extractRestrictedQtyMap(restrictedCards: Map<string, RestrictedCard>) {
  const map = new Map<string, number>();
  for (const [cardId, details] of restrictedCards.entries()) {
    map.set(cardId, details.restrictedQty);
  }
  return map;
}

async function buildRestrictionContext(userId: string, eventId: string, roundNumber: number, poolQuantityByCardId: Map<string, number>) {
  const eventRule = await prisma.deckUniquenessRule.findUnique({
    where: { eventId },
    select: {
      constraintType: true,
      parameters: true,
    },
  });

  const { priorDecklists, priorRoundEntries } = await getPriorRoundEntries(userId, eventId, roundNumber);
  if (!eventRule) {
    return {
      restrictedCards: new Map<string, RestrictedCard>(),
      minChanges: 0,
      priorDecklists,
      constraintType: null as ConstraintType | null,
    };
  }

  const constraintType = eventRule.constraintType as ConstraintType;
  const restrictedCards = computeRestrictedCopies({
    constraintType,
    poolQuantityByCardId,
    priorRoundEntries,
  });

  return {
    restrictedCards,
    minChanges: parseMinChanges(eventRule.parameters),
    priorDecklists,
    constraintType,
  };
}

export async function getDecklistById(
  decklistId: string,
  viewer?: { id: string; role: 'admin' | 'user' } | null,
) {
  const decklist = await prisma.decklist.findUnique({
    where: { id: decklistId },
    include: {
      event: {
        include: {
          config: true,
          season: {
            select: {
              id: true,
              poolVisibility: true,
              decklistVisibility: true,
              scheduleVisibility: true,
            },
          },
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
          cachedCard: true,
        },
      },
    },
  });

  if (!decklist) {
    throw new AppError(404, 'NOT_FOUND', 'Decklist not found');
  }

  const season = decklist.event.season;
  if (
    !isDecklistVisibleToViewer(decklist, season, viewer ?? null, {
      eventStatus: decklist.event.status,
      roundStatus: decklist.round.status,
    })
  ) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this decklist');
  }

  const { poolId } = await getPoolCardsForUserSeason(decklist.userId, decklist.event.season.id);
  return {
    ...decklist,
    poolId,
  };
}

const seasonDecklistInclude = {
  user: {
    select: {
      id: true,
      displayName: true,
      publicName: true,
      discordHandle: true,
      slug: true,
      avatarUrl: true,
    },
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

export async function listVisibleDecklistsForSeason(
  seasonId: string,
  viewer?: { id: string; role: 'admin' | 'user' } | null,
) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      decklistVisibility: true,
      poolVisibility: true,
      scheduleVisibility: true,
    },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  const decklists = await prisma.decklist.findMany({
    where: {
      event: { seasonId },
    },
    include: seasonDecklistInclude,
    orderBy: [{ event: { orderIndex: 'asc' } }, { round: { roundNumber: 'asc' } }, { orderIndex: 'asc' }],
  });

  return decklists.filter((decklist) =>
    isDecklistVisibleToViewer(decklist, season, viewer ?? null, {
      eventStatus: decklist.event.status,
      roundStatus: decklist.round.status,
    }),
  );
}

export async function listVisibleDecklistsForEvent(
  eventId: string,
  viewer?: { id: string; role: 'admin' | 'user' } | null,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      season: {
        select: {
          id: true,
          decklistVisibility: true,
          poolVisibility: true,
          scheduleVisibility: true,
        },
      },
    },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  const decklists = await prisma.decklist.findMany({
    where: { eventId },
    include: seasonDecklistInclude,
    orderBy: [{ round: { roundNumber: 'asc' } }, { orderIndex: 'asc' }],
  });

  return decklists.filter((decklist) =>
    isDecklistVisibleToViewer(decklist, event.season, viewer ?? null, {
      eventStatus: decklist.event.status,
      roundStatus: decklist.round.status,
    }),
  );
}

export async function listDecklistsForSeason(userId: string, seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true },
  });
  if (!season) {
    throw new AppError(404, 'NOT_FOUND', 'Season not found');
  }

  const decklists = await prisma.decklist.findMany({
    where: {
      userId,
      event: {
        seasonId,
      },
    },
    include: {
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
            },
          },
        },
      },
    },
    orderBy: [{ event: { orderIndex: 'asc' } }, { round: { roundNumber: 'asc' } }, { orderIndex: 'asc' }],
  });

  return decklists;
}

export async function listMyDecklistsForRound(eventId: string, roundId: string, userId: string) {
  const { event, round } = await getEventRoundContext(eventId, roundId);
  const deckCount = Math.max(1, event.config?.deckCount ?? 1);
  const { poolId, poolQuantityByCardId, basicLandCardIds, basicLandCatalog } = await getPoolCardsForUserSeason(userId, event.season.id);

  let decklists = await prisma.decklist.findMany({
    where: {
      userId,
      eventId,
      roundId,
    },
    include: {
      entries: {
        include: {
          cachedCard: true,
        },
      },
    },
    orderBy: {
      orderIndex: 'asc',
    },
  });

  if (decklists.length < deckCount) {
    const existing = new Set(decklists.map((decklist) => decklist.orderIndex));
    const missing = [];
    for (let orderIndex = 0; orderIndex < deckCount; orderIndex += 1) {
      if (!existing.has(orderIndex)) {
        missing.push({
          userId,
          eventId,
          roundId,
          orderIndex,
          name: `Deck ${orderIndex + 1}`,
        });
      }
    }
    if (missing.length > 0) {
      await prisma.decklist.createMany({
        data: missing,
      });
      decklists = await prisma.decklist.findMany({
        where: {
          userId,
          eventId,
          roundId,
        },
        include: {
          entries: {
            include: {
              cachedCard: true,
            },
          },
        },
        orderBy: {
          orderIndex: 'asc',
        },
      });
    }
  }

  const restrictionContext = await buildRestrictionContext(userId, eventId, round.roundNumber, poolQuantityByCardId);
  const restrictedCards = [...restrictionContext.restrictedCards.entries()].map(([cachedCardId, value]) => ({
    cachedCardId,
    restrictedQty: value.restrictedQty,
    reason: value.reason,
  }));

  return {
    poolId,
    roundId: round.id,
    roundNumber: round.roundNumber,
    decklists,
    registeredCount: decklists.filter((decklist) => decklist.status === 'submitted' || decklist.status === 'locked').length,
    eventConfig: event.config,
    basicLandCardIds: [...basicLandCardIds],
    basicLands: [...basicLandCatalog.values()],
    restrictedCards,
  };
}

export async function listMyDecklistsForEvent(eventId: string, userId: string) {
  const selectedRound = await ensureDeckbuilderRound(eventId);
  return listMyDecklistsForRound(eventId, selectedRound.id, userId);
}

export async function createDecklist(input: {
  userId: string;
  eventId: string;
  roundId: string;
  orderIndex?: number;
  name?: string | null;
  prepopulateFromPrevious?: boolean;
}) {
  const { event, round } = await getEventRoundContext(input.eventId, input.roundId);
  await getPoolCardsForUserSeason(input.userId, event.season.id);

  let orderIndex = Math.max(0, input.orderIndex ?? 0);
  if (typeof input.orderIndex !== 'number') {
    const highestOrder = await prisma.decklist.findFirst({
      where: {
        userId: input.userId,
        eventId: input.eventId,
        roundId: input.roundId,
      },
      orderBy: {
        orderIndex: 'desc',
      },
      select: {
        orderIndex: true,
      },
    });
    orderIndex = (highestOrder?.orderIndex ?? -1) + 1;
  }
  const exists = await prisma.decklist.findFirst({
    where: {
      userId: input.userId,
      eventId: input.eventId,
      roundId: input.roundId,
      orderIndex,
    },
    select: { id: true },
  });
  if (exists) {
    throw new AppError(409, 'CONFLICT', 'Decklist already exists for this round and slot');
  }

  let entries: DeckEntryInput[] = [];
  if (input.prepopulateFromPrevious) {
    const previousDeck = await prisma.decklist.findFirst({
      where: {
        userId: input.userId,
        eventId: input.eventId,
        orderIndex,
        round: {
          roundNumber: {
            lt: round.roundNumber,
          },
        },
      },
      orderBy: {
        round: {
          roundNumber: 'desc',
        },
      },
      include: {
        entries: true,
      },
    });
    entries = (previousDeck?.entries ?? []).map((entry) => ({
      cachedCardId: entry.cachedCardId,
      quantity: entry.quantity,
      zone: entry.zone,
    }));
  }

  return prisma.decklist.create({
    data: {
      userId: input.userId,
      eventId: input.eventId,
      roundId: input.roundId,
      orderIndex,
      name: input.name ?? `Deck ${orderIndex + 1}`,
      entries: entries.length
        ? {
            create: entries.map((entry) => ({
              cachedCardId: entry.cachedCardId,
              quantity: entry.quantity,
              zone: entry.zone,
            })),
          }
        : undefined,
    },
    include: {
      entries: {
        include: {
          cachedCard: true,
        },
      },
    },
  });
}

export async function updateDecklist(
  decklistId: string,
  userId: string,
  isAdmin: boolean,
  input: {
    name?: string;
    entries?: DeckEntryInput[];
  },
) {
  const decklist = await prisma.decklist.findUnique({
    where: { id: decklistId },
    include: {
      event: {
        include: {
          season: {
            select: {
              id: true,
            },
          },
          config: true,
        },
      },
      round: {
        select: {
          roundNumber: true,
        },
      },
      entries: {
        include: {
          cachedCard: {
            select: {
              typeLine: true,
            },
          },
        },
      },
    },
  });

  if (!decklist) {
    throw new AppError(404, 'NOT_FOUND', 'Decklist not found');
  }
  if (!isAdmin && decklist.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to update this decklist');
  }
  if (decklist.event.config?.deckLockingMode === 'admin_locked') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Decklist is locked and cannot be edited');
  }

  const isRoundRobin = decklist.event.config?.format === 'round_robin';
  const contentLocked =
    decklist.status === 'locked' || (decklist.status === 'submitted' && !isRoundRobin);
  const normalizedEntries = input.entries ? normalizeEntryInputs(input.entries) : null;

  if (contentLocked) {
    if (normalizedEntries !== null) {
      throw new AppError(409, 'INVALID_EVENT_STATE', 'Decklist contents cannot be edited');
    }
    if (typeof input.name !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'At least one field must be provided');
    }
    return prisma.decklist.update({
      where: { id: decklistId },
      data: { name: input.name.trim() || null },
      include: {
        entries: {
          include: {
            cachedCard: true,
          },
        },
      },
    });
  }
  const effectiveEntries =
    normalizedEntries ??
    decklist.entries.map((entry) => ({
      cachedCardId: entry.cachedCardId,
      quantity: entry.quantity,
      zone: entry.zone,
    }));

  const { poolQuantityByCardId, basicLandCardIds } = await getPoolCardsForUserSeason(decklist.userId, decklist.event.season.id);
  const restrictions = await buildRestrictionContext(
    decklist.userId,
    decklist.eventId,
    decklist.round.roundNumber,
    poolQuantityByCardId,
  );
  const restrictedQtyMap = extractRestrictedQtyMap(restrictions.restrictedCards);

  const siblingDecklists = await prisma.decklist.findMany({
    where: {
      userId: decklist.userId,
      eventId: decklist.eventId,
      roundId: decklist.roundId,
      status: {
        in: ['submitted', 'locked'],
      },
      id: {
        not: decklist.id,
      },
    },
    select: {
      entries: {
        select: {
          cachedCardId: true,
          quantity: true,
        },
      },
    },
  });

  const combined = aggregateEntries(
    siblingDecklists.flatMap((item) => item.entries).concat(effectiveEntries.map((entry) => ({ cachedCardId: entry.cachedCardId, quantity: entry.quantity }))),
  );
  const previousCombined = aggregateEntries(
    siblingDecklists
      .flatMap((item) => item.entries)
      .concat(decklist.entries.map((entry) => ({ cachedCardId: entry.cachedCardId, quantity: entry.quantity }))),
  );

  const nextViolations = validateCombinedAllocation({
    poolQuantityByCardId,
    restrictedQuantityByCardId: restrictedQtyMap,
    combinedDeckAllocationByCardId: combined,
    basicLandCardIds,
  });
  const previousViolations = validateCombinedAllocation({
    poolQuantityByCardId,
    restrictedQuantityByCardId: restrictedQtyMap,
    combinedDeckAllocationByCardId: previousCombined,
    basicLandCardIds,
  });
  const worseningViolations = filterNewOrWorsenedAllocationViolations({
    previousViolations,
    nextViolations,
  });

  if (worseningViolations.length > 0) {
    const violation = worseningViolations[0];
    const card = await prisma.cachedCard.findUnique({
      where: { scryfallId: violation.cachedCardId },
      select: {
        name: true,
        setCode: true,
        collectorNumber: true,
      },
    });
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      formatAllocationViolationMessage(violation, card ?? undefined),
      {
        cachedCardId: violation.cachedCardId,
      },
    );
  }

  return prisma.$transaction(async (tx) => {
    if (normalizedEntries) {
      await tx.decklistEntry.deleteMany({
        where: { decklistId },
      });
      if (normalizedEntries.length > 0) {
        await tx.decklistEntry.createMany({
          data: normalizedEntries.map((entry) => ({
            decklistId,
            cachedCardId: entry.cachedCardId,
            quantity: entry.quantity,
            zone: entry.zone,
          })),
        });
      }
    }

    return tx.decklist.update({
      where: { id: decklistId },
      data: {
        ...(typeof input.name === 'string' ? { name: input.name.trim() || null } : {}),
      },
      include: {
        entries: {
          include: {
            cachedCard: true,
          },
        },
      },
    });
  });
}

export async function validateDecklist(decklistId: string, userId: string, isAdmin = false): Promise<DecklistValidationResult> {
  const decklist = await prisma.decklist.findUnique({
    where: { id: decklistId },
    include: {
      event: {
        include: {
          config: true,
          season: {
            select: { id: true },
          },
        },
      },
      round: {
        select: {
          roundNumber: true,
        },
      },
      entries: {
        include: {
          cachedCard: {
            select: {
              typeLine: true,
            },
          },
        },
      },
    },
  });

  if (!decklist) {
    throw new AppError(404, 'NOT_FOUND', 'Decklist not found');
  }
  if (!isAdmin && decklist.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to validate this decklist');
  }

  const { poolQuantityByCardId, basicLandCardIds } = await getPoolCardsForUserSeason(decklist.userId, decklist.event.season.id);
  const restrictions = await buildRestrictionContext(
    decklist.userId,
    decklist.eventId,
    decklist.round.roundNumber,
    poolQuantityByCardId,
  );

  const siblingDecklists = await prisma.decklist.findMany({
    where: {
      userId: decklist.userId,
      eventId: decklist.eventId,
      roundId: decklist.roundId,
      OR: [
        {
          id: decklist.id,
        },
        {
          status: {
            in: ['submitted', 'locked'],
          },
        },
      ],
    },
    select: {
      entries: {
        select: {
          cachedCardId: true,
          quantity: true,
        },
      },
    },
  });

  const combinedAllocation = aggregateEntries(siblingDecklists.flatMap((item) => item.entries));
  const violations = validateCombinedAllocation({
    poolQuantityByCardId,
    restrictedQuantityByCardId: extractRestrictedQtyMap(restrictions.restrictedCards),
    combinedDeckAllocationByCardId: combinedAllocation,
    basicLandCardIds,
  });

  const violationCardIds = [...new Set(violations.map((violation) => violation.cachedCardId))];
  const violationCards = violationCardIds.length
    ? await prisma.cachedCard.findMany({
        where: { scryfallId: { in: violationCardIds } },
        select: {
          scryfallId: true,
          name: true,
          setCode: true,
          collectorNumber: true,
        },
      })
    : [];
  const violationCardById = new Map(violationCards.map((card) => [card.scryfallId, card]));
  const errors = violations.map((violation) =>
    formatAllocationViolationMessage(violation, violationCardById.get(violation.cachedCardId)),
  );
  const warnings: string[] = [];

  const minDeckSize = decklist.event.config?.minDeckSize ?? 40;
  const mainCount = decklist.entries
    .filter((entry) => entry.zone === 'main')
    .reduce((sum, entry) => sum + entry.quantity, 0);
  if (mainCount < minDeckSize) {
    errors.push(`Main deck is below minimum size (${mainCount}/${minDeckSize})`);
  }

  if (decklist.event.config?.sideboardRule === 'fixed_15') {
    const sideboardCount = decklist.entries
      .filter((entry) => entry.zone === 'sideboard')
      .reduce((sum, entry) => sum + entry.quantity, 0);
    if (sideboardCount !== 15) {
      warnings.push(`Sideboard count is ${sideboardCount}; expected 15`);
    }
  }

  if (restrictions.constraintType === 'minimum_changes' && restrictions.minChanges > 0) {
    const previousRoundNumber = decklist.round.roundNumber - 1;
    if (previousRoundNumber > 0) {
      const previousDeck = restrictions.priorDecklists.find(
        (item) => item.orderIndex === decklist.orderIndex && item.round.roundNumber === previousRoundNumber,
      );
      if (previousDeck) {
        const previousCardIds = new Set(
          previousDeck.entries.filter((entry) => !isBasicLand(entry.cachedCard.typeLine)).map((entry) => entry.cachedCardId),
        );
        const shortfall = computeMinimumChangesShortfall({
          minChanges: restrictions.minChanges,
          previousCardIds,
          currentEntries: decklist.entries.map((entry) => ({
            cachedCardId: entry.cachedCardId,
            quantity: entry.quantity,
            typeLine: entry.cachedCard.typeLine,
          })),
        });
        if (shortfall > 0) {
          warnings.push(`${shortfall} more non-basic card changes required from previous round`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    invalidCardIds: [...new Set(violations.map((violation) => violation.cachedCardId))],
  };
}

export async function submitDecklist(decklistId: string, userId: string, isAdmin = false) {
  const decklist = await prisma.decklist.findUnique({
    where: { id: decklistId },
    select: {
      id: true,
      userId: true,
      eventId: true,
      roundId: true,
      status: true,
      event: {
        include: {
          config: true,
        },
      },
    },
  });
  if (!decklist) {
    throw new AppError(404, 'NOT_FOUND', 'Decklist not found');
  }
  if (!isAdmin && decklist.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to submit this decklist');
  }
  if (decklist.status === 'locked') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Decklist is locked');
  }
  if (decklist.event.config?.deckLockingMode === 'admin_locked') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Event deck submissions are admin locked');
  }
  if (decklist.status === 'submitted') {
    return decklist;
  }

  const deckCount = Math.max(1, decklist.event.config?.deckCount ?? 1);
  const registeredDeckCount = await prisma.decklist.count({
    where: {
      userId: decklist.userId,
      eventId: decklist.eventId,
      roundId: decklist.roundId,
      status: {
        in: ['submitted', 'locked'],
      },
      id: {
        not: decklist.id,
      },
    },
  });
  if (registeredDeckCount >= deckCount) {
    throw new AppError(409, 'CONFLICT', `Already registered ${deckCount} deck(s) for this round. Unregister one first.`);
  }

  const validation = await validateDecklist(decklistId, userId, true);
  if (!validation.isValid) {
    throw new AppError(400, 'VALIDATION_ERROR', validation.errors[0] ?? 'Decklist is invalid');
  }

  return prisma.decklist.update({
    where: { id: decklistId },
    data: { status: 'submitted' },
  });
}

export async function unsubmitDecklist(decklistId: string, userId: string, isAdmin = false) {
  const decklist = await prisma.decklist.findUnique({
    where: { id: decklistId },
    select: {
      id: true,
      userId: true,
      eventId: true,
      roundId: true,
      status: true,
      event: {
        include: {
          config: true,
        },
      },
    },
  });
  if (!decklist) {
    throw new AppError(404, 'NOT_FOUND', 'Decklist not found');
  }
  if (!isAdmin && decklist.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to unsubmit this decklist');
  }
  if (decklist.status !== 'submitted') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Only submitted decklists can be unsubmitted');
  }

  const isRoundRobin = decklist.event.config?.format === 'round_robin';
  if (!isRoundRobin) {
    const playedMatch = await prisma.match.findFirst({
      where: {
        roundId: decklist.roundId,
        status: {
          not: 'pending',
        },
        OR: [{ player1Id: decklist.userId }, { player2Id: decklist.userId }],
      },
      select: { id: true },
    });
    if (playedMatch) {
      throw new AppError(409, 'INVALID_EVENT_STATE', 'Cannot unsubmit after a match has been played in this round');
    }
  }

  return prisma.decklist.update({
    where: { id: decklist.id },
    data: { status: 'draft' },
  });
}

export async function deleteDecklist(decklistId: string, userId: string, isAdmin = false) {
  const decklist = await prisma.decklist.findUnique({
    where: { id: decklistId },
    select: {
      id: true,
      userId: true,
      orderIndex: true,
      status: true,
      event: {
        include: {
          config: true,
        },
      },
    },
  });
  if (!decklist) {
    throw new AppError(404, 'NOT_FOUND', 'Decklist not found');
  }
  if (!isAdmin && decklist.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this decklist');
  }
  if (decklist.status !== 'draft') {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Only draft decklists can be deleted');
  }
  const requiredDeckCount = Math.max(1, decklist.event.config?.deckCount ?? 1);
  if (decklist.orderIndex < requiredDeckCount) {
    throw new AppError(409, 'INVALID_EVENT_STATE', 'Cannot delete required deck slots');
  }

  return prisma.decklist.delete({
    where: { id: decklist.id },
  });
}

export async function unlockDecklistsForRound(client: Prisma.TransactionClient, roundId: string) {
  const result = await client.decklist.updateMany({
    where: {
      roundId,
      status: 'locked',
    },
    data: {
      status: 'draft',
    },
  });
  return result.count;
}

export function createDecklistService() {
  return {
    getDecklistById,
    listVisibleDecklistsForSeason,
    listVisibleDecklistsForEvent,
    listDecklistsForSeason,
    ensureDeckbuilderRound,
    listMyDecklistsForEvent,
    listMyDecklistsForRound,
    createDecklist,
    updateDecklist,
    validateDecklist,
    submitDecklist,
    unsubmitDecklist,
    deleteDecklist,
    unlockDecklistsForRound,
  };
}
