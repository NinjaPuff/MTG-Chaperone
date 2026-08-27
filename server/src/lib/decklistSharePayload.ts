import { createHash } from 'node:crypto';
import {
  canonicalizeDeckShareEntries,
  INVALID_SHARE_CODE,
  type DeckShareEntry,
  type DeckSharePayload,
  type DeckShareStatus,
} from '@mtg-league/shared';
import { AppError } from '../middleware/errorHandler.js';

const STATUSES = new Set<DeckShareStatus>(['draft', 'submitted', 'locked']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseShareEntry(value: unknown): DeckShareEntry {
  if (!isRecord(value)) {
    throw new AppError(404, INVALID_SHARE_CODE, 'Share link is invalid');
  }
  const { scryfallId, quantity, zone, name, layout, manaCost, typeLine, cmc, colorIdentity } = value;
  if (
    typeof scryfallId !== 'string' ||
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    (zone !== 'main' && zone !== 'sideboard') ||
    typeof name !== 'string' ||
    (layout !== null && typeof layout !== 'string') ||
    (manaCost !== null && typeof manaCost !== 'string') ||
    typeof typeLine !== 'string' ||
    typeof cmc !== 'number' ||
    !Array.isArray(colorIdentity) ||
    colorIdentity.some((color) => typeof color !== 'string')
  ) {
    throw new AppError(404, INVALID_SHARE_CODE, 'Share link is invalid');
  }
  return {
    scryfallId,
    quantity,
    zone,
    name,
    layout,
    manaCost,
    typeLine,
    cmc,
    colorIdentity: [...colorIdentity],
    ...(typeof value.setCode === 'string' && value.setCode.trim()
      ? { setCode: value.setCode.trim().toUpperCase() }
      : {}),
    ...(typeof value.collectorNumber === 'string' && value.collectorNumber.trim()
      ? { collectorNumber: value.collectorNumber.trim() }
      : {}),
  };
}

export function parseStoredSharePayload(value: unknown): DeckSharePayload {
  if (!isRecord(value) || value.v !== 1) {
    throw new AppError(404, INVALID_SHARE_CODE, 'Share link is invalid');
  }
  if (
    typeof value.ownerDisplayName !== 'string' ||
    typeof value.deckName !== 'string' ||
    typeof value.eventName !== 'string' ||
    typeof value.roundNumber !== 'number' ||
    !Number.isInteger(value.roundNumber) ||
    typeof value.status !== 'string' ||
    !STATUSES.has(value.status as DeckShareStatus) ||
    !Array.isArray(value.entries)
  ) {
    throw new AppError(404, INVALID_SHARE_CODE, 'Share link is invalid');
  }
  return {
    v: 1,
    ownerDisplayName: value.ownerDisplayName,
    deckName: value.deckName,
    eventName: value.eventName,
    roundNumber: value.roundNumber,
    status: value.status as DeckShareStatus,
    entries: canonicalizeDeckShareEntries(value.entries.map(parseShareEntry)),
  };
}

export function stampShareOwner(payload: DeckSharePayload, ownerDisplayName: string): DeckSharePayload {
  return {
    v: 1,
    ownerDisplayName,
    deckName: payload.deckName,
    eventName: payload.eventName,
    roundNumber: payload.roundNumber,
    status: payload.status,
    entries: canonicalizeDeckShareEntries(payload.entries),
  };
}

export type LiveShareDecklist = {
  name: string | null;
  orderIndex: number;
  status: DeckShareStatus;
  eventName: string;
  roundNumber: number;
  ownerDisplayName: string;
  entries: Array<{
    cachedCardId: string;
    quantity: number;
    zone: 'main' | 'sideboard';
    cachedCard: {
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
  }>;
};

export function liveDecklistToShareEntries(entries: LiveShareDecklist['entries']): DeckShareEntry[] {
  return canonicalizeDeckShareEntries(
    entries.map((item) => ({
      scryfallId: item.cachedCardId,
      quantity: item.quantity,
      zone: item.zone,
      name: item.cachedCard.name,
      layout: item.cachedCard.layout,
      manaCost: item.cachedCard.manaCost,
      typeLine: item.cachedCard.typeLine,
      cmc: item.cachedCard.cmc,
      colorIdentity: [...item.cachedCard.colorIdentity],
      ...(item.cachedCard.setCode ? { setCode: item.cachedCard.setCode } : {}),
      ...(item.cachedCard.collectorNumber ? { collectorNumber: item.cachedCard.collectorNumber } : {}),
    })),
  );
}

export function resolveMintSharePayload(args: {
  viewerIsOwner: boolean;
  clientPayload: DeckSharePayload;
  live: LiveShareDecklist;
}): DeckSharePayload {
  const liveName = args.live.name ?? `Deck ${args.live.orderIndex + 1}`;
  if (args.viewerIsOwner) {
    return {
      v: 1,
      ownerDisplayName: args.live.ownerDisplayName,
      deckName: args.clientPayload.deckName,
      eventName: args.live.eventName,
      roundNumber: args.live.roundNumber,
      status: args.live.status,
      entries: canonicalizeDeckShareEntries(args.clientPayload.entries),
    };
  }
  return {
    v: 1,
    ownerDisplayName: args.live.ownerDisplayName,
    deckName: liveName,
    eventName: args.live.eventName,
    roundNumber: args.live.roundNumber,
    status: args.live.status,
    entries: liveDecklistToShareEntries(args.live.entries),
  };
}

export function hashShareContents(payload: DeckSharePayload, decklistId: string): string {
  const canonical = {
    d: decklistId,
    n: payload.deckName,
    e: payload.eventName,
    r: payload.roundNumber,
    s: payload.status,
    c: canonicalizeDeckShareEntries(payload.entries).map((item) => [
      item.scryfallId,
      item.quantity,
      item.zone,
      item.setCode ?? '',
      item.collectorNumber ?? '',
    ]),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
