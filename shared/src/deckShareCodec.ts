// lz-string is CJS. Node ESM (tsx / the API server) rejects named imports from it.
import lzString from 'lz-string';
import { deflateSync, inflateSync } from 'fflate';

const { decompressFromEncodedURIComponent } = lzString;

export const DECK_SHARE_PREFIX = 'v1.';
export const DECK_SHARE_V2_PREFIX = 'v2.';
export const INVALID_SHARE_CODE = 'INVALID_SHARE' as const;

export class DeckShareDecodeError extends Error {
  readonly code = INVALID_SHARE_CODE;

  constructor(message = 'Share link is invalid') {
    super(message);
    this.name = 'DeckShareDecodeError';
  }
}

export type DeckShareStatus = 'draft' | 'submitted' | 'locked';
export type DeckShareZone = 'main' | 'sideboard';

export type DeckShareEntry = {
  scryfallId: string;
  quantity: number;
  zone: DeckShareZone;
  name: string;
  layout: string | null;
  manaCost: string | null;
  typeLine: string;
  cmc: number;
  colorIdentity: string[];
};

export type DeckSharePayload = {
  v: 1;
  ownerDisplayName: string;
  deckName: string;
  eventName: string;
  roundNumber: number;
  status: DeckShareStatus;
  entries: DeckShareEntry[];
};

type WireEntry = [
  string,
  number,
  0 | 1,
  string,
  string | null,
  string | null,
  string,
  number,
  string[],
];

type WirePayload = {
  v: 1;
  o: string;
  n: string;
  e: string;
  r: number;
  s: DeckShareStatus;
  c: WireEntry[];
};

const STATUSES: DeckShareStatus[] = ['draft', 'submitted', 'locked'];
const STATUSES_SET = new Set<DeckShareStatus>(STATUSES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FLAG_SIDEBOARD = 1;
const FLAG_PACKED_UUID = 2;

function zoneRank(zone: DeckShareZone): 0 | 1 {
  return zone === 'main' ? 0 : 1;
}

export function canonicalizeDeckShareEntries(entries: DeckShareEntry[]): DeckShareEntry[] {
  return [...entries]
    .map((entry) => ({
      scryfallId: entry.scryfallId,
      quantity: entry.quantity,
      zone: entry.zone,
      name: entry.name,
      layout: entry.layout,
      manaCost: entry.manaCost,
      typeLine: entry.typeLine,
      cmc: entry.cmc,
      colorIdentity: [...entry.colorIdentity],
    }))
    .sort((left, right) => {
      const zoneDiff = zoneRank(left.zone) - zoneRank(right.zone);
      if (zoneDiff !== 0) {
        return zoneDiff;
      }
      return left.scryfallId.localeCompare(right.scryfallId);
    });
}

function slimEntry(scryfallId: string, quantity: number, zone: DeckShareZone): DeckShareEntry {
  return {
    scryfallId,
    quantity,
    zone,
    name: '',
    layout: null,
    manaCost: null,
    typeLine: '',
    cmc: 0,
    colorIdentity: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseWireEntry(value: unknown): DeckShareEntry {
  if (!Array.isArray(value) || value.length !== 9) {
    throw new DeckShareDecodeError();
  }
  const [scryfallId, quantity, zoneBit, name, layout, manaCost, typeLine, cmc, colorIdentity] = value;
  if (
    typeof scryfallId !== 'string' ||
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    (zoneBit !== 0 && zoneBit !== 1) ||
    typeof name !== 'string' ||
    (layout !== null && typeof layout !== 'string') ||
    (manaCost !== null && typeof manaCost !== 'string') ||
    typeof typeLine !== 'string' ||
    typeof cmc !== 'number' ||
    !Array.isArray(colorIdentity) ||
    colorIdentity.some((color) => typeof color !== 'string')
  ) {
    throw new DeckShareDecodeError();
  }
  return {
    scryfallId,
    quantity,
    zone: zoneBit === 0 ? 'main' : 'sideboard',
    name,
    layout,
    manaCost,
    typeLine,
    cmc,
    colorIdentity: [...colorIdentity],
  };
}

function parseWire(value: unknown): DeckSharePayload {
  if (!isRecord(value) || value.v !== 1) {
    throw new DeckShareDecodeError();
  }
  if (
    typeof value.o !== 'string' ||
    typeof value.n !== 'string' ||
    typeof value.e !== 'string' ||
    typeof value.r !== 'number' ||
    !Number.isInteger(value.r) ||
    typeof value.s !== 'string' ||
    !STATUSES_SET.has(value.s as DeckShareStatus) ||
    !Array.isArray(value.c)
  ) {
    throw new DeckShareDecodeError();
  }
  return {
    v: 1,
    ownerDisplayName: value.o,
    deckName: value.n,
    eventName: value.e,
    roundNumber: value.r,
    status: value.s as DeckShareStatus,
    entries: canonicalizeDeckShareEntries(value.c.map(parseWireEntry)),
  };
}

function decodeV1(encoded: string): DeckSharePayload {
  const compressed = encoded.slice(DECK_SHARE_PREFIX.length);
  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(compressed);
  } catch {
    throw new DeckShareDecodeError();
  }
  if (!json) {
    throw new DeckShareDecodeError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new DeckShareDecodeError();
  }
  return parseWire(parsed);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new DeckShareDecodeError();
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function uuidToBytes(id: string): Uint8Array {
  const hex = id.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

class ByteWriter {
  private readonly chunks: Uint8Array[] = [];

  writeU8(value: number) {
    this.chunks.push(Uint8Array.of(value));
  }

  writeU16(value: number) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    this.chunks.push(bytes);
  }

  writeBytes(bytes: Uint8Array) {
    this.chunks.push(bytes);
  }

  writeString(value: string) {
    const bytes = new TextEncoder().encode(value);
    if (bytes.length > 0xffff) {
      throw new DeckShareDecodeError();
    }
    this.writeU16(bytes.length);
    this.writeBytes(bytes);
  }

  toBytes() {
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

class ByteReader {
  constructor(
    private readonly bytes: Uint8Array,
    private offset = 0,
  ) {}

  remaining() {
    return this.bytes.length - this.offset;
  }

  readU8() {
    if (this.remaining() < 1) {
      throw new DeckShareDecodeError();
    }
    const value = this.bytes[this.offset];
    this.offset += 1;
    return value;
  }

  readU16() {
    if (this.remaining() < 2) {
      throw new DeckShareDecodeError();
    }
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 2).getUint16(0, true);
    this.offset += 2;
    return value;
  }

  readBytes(length: number) {
    if (length < 0 || this.remaining() < length) {
      throw new DeckShareDecodeError();
    }
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  readString() {
    const length = this.readU16();
    return new TextDecoder().decode(this.readBytes(length));
  }
}

function encodeV2Binary(payload: DeckSharePayload): Uint8Array {
  const writer = new ByteWriter();
  writer.writeString(payload.ownerDisplayName);
  writer.writeString(payload.deckName);
  writer.writeString(payload.eventName);
  if (payload.roundNumber < 0 || payload.roundNumber > 0xffff || !Number.isInteger(payload.roundNumber)) {
    throw new DeckShareDecodeError();
  }
  writer.writeU16(payload.roundNumber);
  const status = STATUSES.indexOf(payload.status);
  if (status < 0) {
    throw new DeckShareDecodeError();
  }
  writer.writeU8(status);
  const entries = canonicalizeDeckShareEntries(payload.entries);
  if (entries.length > 0xffff) {
    throw new DeckShareDecodeError();
  }
  writer.writeU16(entries.length);
  for (const item of entries) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 0xffff) {
      throw new DeckShareDecodeError();
    }
    const packed = UUID_RE.test(item.scryfallId);
    writer.writeU8((item.zone === 'sideboard' ? FLAG_SIDEBOARD : 0) | (packed ? FLAG_PACKED_UUID : 0));
    writer.writeU16(item.quantity);
    if (packed) {
      writer.writeBytes(uuidToBytes(item.scryfallId));
    } else {
      writer.writeString(item.scryfallId);
    }
  }
  return writer.toBytes();
}

function decodeV2Binary(bytes: Uint8Array): DeckSharePayload {
  const reader = new ByteReader(bytes);
  const ownerDisplayName = reader.readString();
  const deckName = reader.readString();
  const eventName = reader.readString();
  const roundNumber = reader.readU16();
  const statusIndex = reader.readU8();
  const status = STATUSES[statusIndex];
  if (!status) {
    throw new DeckShareDecodeError();
  }
  const count = reader.readU16();
  const entries: DeckShareEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const flags = reader.readU8();
    const quantity = reader.readU16();
    if (quantity < 1) {
      throw new DeckShareDecodeError();
    }
    const zone: DeckShareZone = flags & FLAG_SIDEBOARD ? 'sideboard' : 'main';
    const scryfallId =
      flags & FLAG_PACKED_UUID ? bytesToUuid(reader.readBytes(16)) : reader.readString();
    entries.push(slimEntry(scryfallId, quantity, zone));
  }
  if (reader.remaining() !== 0) {
    throw new DeckShareDecodeError();
  }
  return {
    v: 1,
    ownerDisplayName,
    deckName,
    eventName,
    roundNumber,
    status,
    entries: canonicalizeDeckShareEntries(entries),
  };
}

function decodeV2(encoded: string): DeckSharePayload {
  const compressed = encoded.slice(DECK_SHARE_V2_PREFIX.length);
  if (!compressed) {
    throw new DeckShareDecodeError();
  }
  let inflated: Uint8Array;
  try {
    inflated = inflateSync(base64UrlToBytes(compressed));
  } catch {
    throw new DeckShareDecodeError();
  }
  return decodeV2Binary(inflated);
}

export function encodeDeckSharePayload(payload: DeckSharePayload): string {
  const deflated = deflateSync(encodeV2Binary(payload), { level: 9 });
  if (!deflated.length) {
    throw new DeckShareDecodeError();
  }
  return `${DECK_SHARE_V2_PREFIX}${bytesToBase64Url(deflated)}`;
}

export function decodeDeckSharePayload(encoded: string): DeckSharePayload {
  if (encoded.startsWith(DECK_SHARE_V2_PREFIX)) {
    return decodeV2(encoded);
  }
  if (!encoded.startsWith(DECK_SHARE_PREFIX) || encoded.length <= DECK_SHARE_PREFIX.length) {
    throw new DeckShareDecodeError();
  }
  return decodeV1(encoded);
}
