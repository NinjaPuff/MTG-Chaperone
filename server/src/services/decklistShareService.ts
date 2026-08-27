import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { DeckSharePayload } from '@mtg-league/shared';
import { INVALID_SHARE_CODE } from '@mtg-league/shared';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { isDecklistVisibleToViewer } from '../lib/visibilityRules.js';
import {
  hashShareContents,
  parseStoredSharePayload,
  resolveMintSharePayload,
} from '../lib/decklistSharePayload.js';

type ShareUser = {
  id: string;
  displayName: string;
  publicName?: string | null;
  role: 'admin' | 'user';
};

const cachedCardSelect = {
  scryfallId: true,
  name: true,
  layout: true,
  manaCost: true,
  typeLine: true,
  cmc: true,
  colorIdentity: true,
  setCode: true,
  collectorNumber: true,
} as const;

const decklistShareSelect = {
  id: true,
  userId: true,
  name: true,
  orderIndex: true,
  status: true,
  user: { select: { displayName: true, publicName: true } },
  event: {
    select: {
      status: true,
      name: true,
      season: {
        select: { poolVisibility: true, decklistVisibility: true, scheduleVisibility: true },
      },
    },
  },
  round: { select: { status: true, roundNumber: true } },
  entries: {
    include: {
      cachedCard: {
        select: cachedCardSelect,
      },
    },
  },
} as const;

type ShareCachedCard = {
  scryfallId: string;
  name: string;
  layout: string | null;
  manaCost: string | null;
  typeLine: string;
  cmc: number;
  colorIdentity: string[];
  setCode: string;
  collectorNumber: string | null;
};

type ShareDecklistRow = {
  id: string;
  userId: string;
  name: string | null;
  orderIndex: number;
  status: 'draft' | 'submitted' | 'locked';
  user: { displayName: string; publicName: string | null };
  event: {
    status: 'setup' | 'active' | 'completed';
    name: string;
    season: { poolVisibility: boolean; decklistVisibility: boolean; scheduleVisibility: boolean };
  };
  round: { status: 'not_started' | 'in_progress' | 'completed'; roundNumber: number };
  entries: Array<{
    cachedCardId: string;
    quantity: number;
    zone: 'main' | 'sideboard';
    cachedCard: ShareCachedCard;
  }>;
};

type ShareDb = {
  decklist: {
    findUnique: (args: {
      where: { id: string };
      select: typeof decklistShareSelect;
    }) => Promise<ShareDecklistRow | null>;
  };
  decklistShare: {
    findUnique: (args: {
      where:
        | { token: string }
        | { createdById_contentsHash: { createdById: string; contentsHash: string } };
      select: { token?: true; payload?: true };
    }) => Promise<{ token?: string; payload?: Prisma.JsonValue } | null>;
    create: (args: {
      data: {
        token: string;
        contentsHash: string;
        payload: Prisma.InputJsonValue;
        createdById: string;
        decklistId: string;
      };
    }) => Promise<{ token: string }>;
  };
};

type DecklistShareServiceDeps = {
  prisma: ShareDb;
  generateShareToken: () => string;
};

export function createDecklistShareService(partialDeps?: Partial<DecklistShareServiceDeps>) {
  const deps: DecklistShareServiceDeps = {
    prisma: prisma as unknown as ShareDb,
    generateShareToken: () => crypto.randomBytes(18).toString('base64url'),
    ...partialDeps,
  };

  async function createDecklistShare(input: {
    user: ShareUser;
    decklistId: string;
    payload: DeckSharePayload;
  }) {
    const decklist = await deps.prisma.decklist.findUnique({
      where: { id: input.decklistId },
      select: decklistShareSelect,
    });

    if (!decklist) {
      throw new AppError(404, 'NOT_FOUND', 'Decklist not found');
    }

    if (!isDecklistVisibleToViewer(decklist, decklist.event.season, input.user)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to share this decklist');
    }

    const ownerDisplayName = decklist.user.publicName || decklist.user.displayName;
    const stamped = resolveMintSharePayload({
      viewerIsOwner: input.user.id === decklist.userId,
      clientPayload: input.payload,
      live: {
        name: decklist.name,
        orderIndex: decklist.orderIndex,
        status: decklist.status,
        eventName: decklist.event.name,
        roundNumber: decklist.round.roundNumber,
        ownerDisplayName,
        entries: decklist.entries,
      },
    });
    const contentsHash = hashShareContents(stamped, decklist.id);

    const existing = await deps.prisma.decklistShare.findUnique({
      where: {
        createdById_contentsHash: {
          createdById: input.user.id,
          contentsHash,
        },
      },
      select: { token: true },
    });

    if (existing) {
      return { token: existing.token };
    }

    const created = await deps.prisma.decklistShare.create({
      data: {
        token: deps.generateShareToken(),
        contentsHash,
        payload: stamped as Prisma.InputJsonValue,
        createdById: input.user.id,
        decklistId: decklist.id,
      },
    });

    return { token: created.token };
  }

  async function getDecklistShare(token: string) {
    const row = await deps.prisma.decklistShare.findUnique({
      where: { token },
      select: { payload: true },
    });

    if (!row) {
      throw new AppError(404, INVALID_SHARE_CODE, 'Share link is invalid');
    }

    return parseStoredSharePayload(row.payload);
  }

  return { createDecklistShare, getDecklistShare };
}

const defaultShareService = createDecklistShareService();
export const createDecklistShare = defaultShareService.createDecklistShare;
export const getDecklistShare = defaultShareService.getDecklistShare;
