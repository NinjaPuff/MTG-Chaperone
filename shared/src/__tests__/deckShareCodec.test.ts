import { describe, expect, it } from 'vitest';
import {
  DeckShareDecodeError,
  decodeDeckSharePayload,
  encodeDeckSharePayload,
  type DeckSharePayload,
} from '../deckShareCodec.js';

const V1_NAMED_FIXTURE =
  'v1.N4IgbiBcCMA0IHsogIIBsCWBjApieAdsgCI5YDWABNPiHpCAOo45U3wBOUcIAzsgBMOAQwBmAF1pYoAbRl8AFggoBadgBZYABngBlJRVoEEHALbC0tYACUAvrQCSBXuOEFJsOPOsgAur9h5AFcCbAQBHDV8OB1UHHEFHA5KADUMCyMTc0t4YGh7eBQOcQxRYSwPL39fWyA';

function uuid(index: number) {
  let x = ((index + 1) * 0x9e3779b9) >>> 0;
  let hex = '';
  for (let j = 0; j < 32; j++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    hex += (x % 16).toString(16);
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function entry(
  overrides: Partial<DeckSharePayload['entries'][number]> &
    Pick<DeckSharePayload['entries'][number], 'scryfallId' | 'name' | 'zone'>,
): DeckSharePayload['entries'][number] {
  return {
    quantity: 1,
    layout: 'normal',
    manaCost: '{R}',
    typeLine: 'Instant',
    cmc: 1,
    colorIdentity: ['R'],
    ...overrides,
  };
}

function payload(overrides: Partial<DeckSharePayload> = {}): DeckSharePayload {
  return {
    v: 1,
    ownerDisplayName: 'Alice',
    deckName: 'Deck 1',
    eventName: 'Week 1',
    roundNumber: 1,
    status: 'draft',
    entries: [
      entry({ scryfallId: 'shock-1', name: 'Shock', zone: 'main', quantity: 2 }),
      entry({
        scryfallId: 'negate-1',
        name: 'Negate',
        zone: 'sideboard',
        manaCost: '{1}{U}',
        typeLine: 'Instant',
        cmc: 2,
        colorIdentity: ['U'],
      }),
    ],
    ...overrides,
  };
}

function slim(entryValue: DeckSharePayload['entries'][number]): DeckSharePayload['entries'][number] {
  return {
    scryfallId: entryValue.scryfallId,
    quantity: entryValue.quantity,
    zone: entryValue.zone,
    name: '',
    layout: null,
    manaCost: null,
    typeLine: '',
    cmc: 0,
    colorIdentity: [],
  };
}

describe('deckShareCodec', () => {
  it('roundtrips main and sideboard ids including unicode names, split layout, empty color identity, and quantity > 1', () => {
    const source = payload({
      entries: [
        entry({
          scryfallId: 'shock-1',
          name: 'Shock',
          zone: 'main',
          quantity: 4,
        }),
        entry({
          scryfallId: 'land-1',
          name: 'Wastes',
          zone: 'main',
          manaCost: null,
          typeLine: 'Basic Land',
          cmc: 0,
          colorIdentity: [],
        }),
        entry({
          scryfallId: 'split-1',
          name: 'Fire // Ice',
          zone: 'sideboard',
          layout: 'split',
          manaCost: '{1}{R} // {1}{U}',
          typeLine: 'Instant // Instant',
          cmc: 2,
          colorIdentity: ['R', 'U'],
        }),
        entry({
          scryfallId: 'shock-1',
          name: 'Shock',
          zone: 'sideboard',
          quantity: 1,
        }),
        entry({
          scryfallId: 'unicode-1',
          name: 'Æther Vial',
          zone: 'main',
          manaCost: '{1}',
          typeLine: 'Artifact',
          cmc: 1,
          colorIdentity: [],
        }),
      ],
    });

    const decoded = decodeDeckSharePayload(encodeDeckSharePayload(source));
    expect(decoded.ownerDisplayName).toBe('Alice');
    expect(decoded.deckName).toBe('Deck 1');
    expect(decoded.eventName).toBe('Week 1');
    expect(decoded.roundNumber).toBe(1);
    expect(decoded.status).toBe('draft');
    expect(decoded.entries).toEqual([
      slim(source.entries.find((item) => item.scryfallId === 'land-1')!),
      slim(source.entries.find((item) => item.scryfallId === 'shock-1' && item.zone === 'main')!),
      slim(source.entries.find((item) => item.scryfallId === 'unicode-1')!),
      slim(source.entries.find((item) => item.scryfallId === 'shock-1' && item.zone === 'sideboard')!),
      slim(source.entries.find((item) => item.scryfallId === 'split-1')!),
    ]);
  });

  it('canonicalizes entry order so shuffling does not change the encoded string', () => {
    const first = payload({
      entries: [
        entry({ scryfallId: 'b', name: 'Beta', zone: 'sideboard' }),
        entry({ scryfallId: 'a', name: 'Alpha', zone: 'main' }),
        entry({ scryfallId: 'c', name: 'Gamma', zone: 'main' }),
      ],
    });
    const shuffled = payload({
      entries: [
        entry({ scryfallId: 'c', name: 'Gamma', zone: 'main' }),
        entry({ scryfallId: 'b', name: 'Beta', zone: 'sideboard' }),
        entry({ scryfallId: 'a', name: 'Alpha', zone: 'main' }),
      ],
    });

    const encoded = encodeDeckSharePayload(first);
    expect(encodeDeckSharePayload(shuffled)).toBe(encoded);
    expect(encodeDeckSharePayload(first)).toBe(encoded);
    expect(encoded.startsWith('v2.')).toBe(true);
  });

  it('omits origin deck UUID, imageUris, and sharedAt from the decoded payload', () => {
    const decoded = decodeDeckSharePayload(encodeDeckSharePayload(payload()));
    expect(decoded).not.toHaveProperty('id');
    expect(decoded).not.toHaveProperty('imageUris');
    expect(decoded).not.toHaveProperty('sharedAt');
    expect(JSON.stringify(decoded)).not.toContain('imageUris');
    expect(JSON.stringify(decoded)).not.toContain('sharedAt');
  });

  it('roundtrips an empty entry list', () => {
    const decoded = decodeDeckSharePayload(encodeDeckSharePayload(payload({ entries: [] })));
    expect(decoded.entries).toEqual([]);
  });

  it('roundtrips packed Scryfall UUIDs', () => {
    const id = uuid(0);
    const decoded = decodeDeckSharePayload(
      encodeDeckSharePayload(payload({ entries: [entry({ scryfallId: id, name: 'Shock', zone: 'main' })] })),
    );
    expect(decoded.entries[0]?.scryfallId).toBe(id);
    expect(decoded.entries[0]?.name).toBe('');
  });

  it('still decodes a frozen v1 named snapshot', () => {
    const decoded = decodeDeckSharePayload(V1_NAMED_FIXTURE);
    expect(decoded.entries.map((item) => item.name)).toEqual(['Shock', 'Aether Vial']);
    expect(decoded.entries.map((item) => item.scryfallId)).toEqual(['shock-1', 'unicode-1']);
  });

  it.each([
    ['v2.abc', 'v2 prefix'],
    ['v2.', 'truncated v2 payload'],
    ['v1.%%%not-valid%%%', 'garbage after v1 prefix'],
    ['v1.', 'truncated v1 payload'],
    ['', 'empty string'],
    ['N4Ig', 'missing prefix'],
  ])('throws INVALID_SHARE for %s', (value) => {
    try {
      decodeDeckSharePayload(value);
      expect.unreachable('expected decode to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DeckShareDecodeError);
      expect((error as DeckShareDecodeError).code).toBe('INVALID_SHARE');
    }
  });

  it('keeps a 60 unique-UUID fixture under the Discord URL length canary', () => {
    const entries = Array.from({ length: 60 }, (_, index) =>
      entry({
        scryfallId: uuid(index),
        name: `Card ${String(index).padStart(2, '0')}`,
        zone: index < 40 ? 'main' : 'sideboard',
        quantity: 1,
      }),
    );
    const encoded = encodeDeckSharePayload(payload({ entries }));
    expect(decodeDeckSharePayload(encoded).entries).toHaveLength(60);
    expect(encoded.startsWith('v2.')).toBe(true);
    expect(`https://example.test/share/decks#${encoded}`.length).toBeLessThanOrEqual(2000);
  });
});
