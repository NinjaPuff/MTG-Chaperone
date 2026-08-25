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

export function hashShareContents(payload: DeckSharePayload): string {
  const canonical = {
    n: payload.deckName,
    e: payload.eventName,
    r: payload.roundNumber,
    s: payload.status,
    c: canonicalizeDeckShareEntries(payload.entries).map((item) => [
      item.scryfallId,
      item.quantity,
      item.zone,
    ]),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
