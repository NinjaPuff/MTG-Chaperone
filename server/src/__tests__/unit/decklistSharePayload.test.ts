import { describe, expect, it } from 'vitest';
import type { DeckSharePayload } from '@mtg-league/shared';
import { AppError } from '../../middleware/errorHandler.js';
import {
  hashShareContents,
  parseStoredSharePayload,
  resolveMintSharePayload,
  stampShareOwner,
} from '../../lib/decklistSharePayload.js';

function entry(
  overrides: Partial<DeckSharePayload['entries'][number]> &
    Pick<DeckSharePayload['entries'][number], 'scryfallId' | 'zone'>,
): DeckSharePayload['entries'][number] {
  return {
    quantity: 1,
    name: 'Shock',
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
      entry({ scryfallId: 'shock-1', zone: 'main', quantity: 2, name: 'Shock' }),
      entry({
        scryfallId: 'negate-1',
        zone: 'sideboard',
        name: 'Negate',
        manaCost: '{1}{U}',
        colorIdentity: ['U'],
        cmc: 2,
      }),
    ],
    ...overrides,
  };
}

const shockLiveEntry = {
  cachedCardId: 'shock-1',
  quantity: 2,
  zone: 'main' as const,
  cachedCard: {
    scryfallId: 'shock-1',
    name: 'Shock',
    layout: 'normal',
    manaCost: '{R}',
    typeLine: 'Instant',
    cmc: 1,
    colorIdentity: ['R'],
    setCode: 'M10',
    collectorNumber: '146',
  },
};

const live = {
  name: 'Deck 1',
  orderIndex: 0,
  status: 'submitted' as const,
  eventName: 'Week 1',
  roundNumber: 1,
  ownerDisplayName: 'Alice',
  entries: [shockLiveEntry],
};

const crafted: DeckSharePayload = {
  v: 1,
  ownerDisplayName: 'Charlie',
  deckName: 'Hijacked',
  eventName: 'Fake',
  roundNumber: 99,
  status: 'locked',
  entries: [
    entry({
      scryfallId: 'negate-1',
      zone: 'main',
      name: 'Negate',
      manaCost: '{1}{U}',
      colorIdentity: ['U'],
      cmc: 2,
    }),
  ],
};

describe('hashShareContents', () => {
  it('is stable across entry shuffle and does not include owner, clock, or display fields', () => {
    const shuffled = payload({
      ownerDisplayName: 'Not Alice',
      entries: [
        entry({
          scryfallId: 'negate-1',
          zone: 'sideboard',
          name: 'Negate renamed',
          manaCost: '{1}{U}',
          colorIdentity: ['U'],
          cmc: 2,
        }),
        entry({ scryfallId: 'shock-1', zone: 'main', quantity: 2, name: 'Shock renamed' }),
      ],
    });

    expect(hashShareContents(shuffled, 'deck-1')).toBe(hashShareContents(payload(), 'deck-1'));
    expect(hashShareContents(payload(), 'deck-1')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when cards, name, event, round, or status change', () => {
    const base = hashShareContents(payload(), 'deck-1');
    expect(hashShareContents(payload({ deckName: 'Deck 2' }), 'deck-1')).not.toBe(base);
    expect(hashShareContents(payload({ eventName: 'Week 2' }), 'deck-1')).not.toBe(base);
    expect(hashShareContents(payload({ roundNumber: 2 }), 'deck-1')).not.toBe(base);
    expect(hashShareContents(payload({ status: 'submitted' }), 'deck-1')).not.toBe(base);
    expect(
      hashShareContents(
        payload({
          entries: [entry({ scryfallId: 'shock-1', zone: 'main', quantity: 3 })],
        }),
        'deck-1',
      ),
    ).not.toBe(base);
  });

  it('changes when decklistId or printings change', () => {
    expect(hashShareContents(payload(), 'deck-a')).not.toBe(hashShareContents(payload(), 'deck-b'));
    const withPrintings = payload({
      entries: [entry({ scryfallId: 'shock-1', zone: 'main', quantity: 2, setCode: 'M10', collectorNumber: '146' })],
    });
    const otherPrinting = payload({
      entries: [entry({ scryfallId: 'shock-1', zone: 'main', quantity: 2, setCode: 'M11', collectorNumber: '146' })],
    });
    expect(hashShareContents(withPrintings, 'deck-1')).not.toBe(hashShareContents(payload(), 'deck-1'));
    expect(hashShareContents(withPrintings, 'deck-1')).not.toBe(hashShareContents(otherPrinting, 'deck-1'));
  });
});

describe('stampShareOwner', () => {
  it('overwrites ownerDisplayName from the authed user and canonicalizes entries', () => {
    const stamped = stampShareOwner(
      payload({
        ownerDisplayName: 'Eve',
        entries: [
          entry({ scryfallId: 'negate-1', zone: 'sideboard', name: 'Negate' }),
          entry({ scryfallId: 'shock-1', zone: 'main', quantity: 2 }),
        ],
      }),
      'Alice',
    );

    expect(stamped.ownerDisplayName).toBe('Alice');
    expect(stamped.entries.map((item) => item.scryfallId)).toEqual(['shock-1', 'negate-1']);
  });
});

describe('resolveMintSharePayload', () => {
  it('uses client entries and deckName for the owner and stamps live metadata', () => {
    const resolved = resolveMintSharePayload({
      viewerIsOwner: true,
      clientPayload: {
        ...crafted,
        deckName: 'Unsaved',
        eventName: '',
        status: 'draft',
        entries: [
          entry({
            scryfallId: 'shock-1',
            zone: 'main',
            quantity: 2,
            setCode: 'M10',
            collectorNumber: '146',
          }),
        ],
      },
      live,
    });

    expect(resolved.deckName).toBe('Unsaved');
    expect(resolved.eventName).toBe('Week 1');
    expect(resolved.roundNumber).toBe(1);
    expect(resolved.status).toBe('submitted');
    expect(resolved.ownerDisplayName).toBe('Alice');
    expect(resolved.entries[0]).toMatchObject({
      scryfallId: 'shock-1',
      setCode: 'M10',
      collectorNumber: '146',
    });
  });

  it('freezes empty owner entries even when the live list has cards', () => {
    const resolved = resolveMintSharePayload({
      viewerIsOwner: true,
      clientPayload: { ...crafted, deckName: 'Empty', entries: [] },
      live,
    });
    expect(resolved.entries).toEqual([]);
    expect(resolved.deckName).toBe('Empty');
  });

  it('ignores client cards and metadata for a non-owner', () => {
    const resolved = resolveMintSharePayload({
      viewerIsOwner: false,
      clientPayload: crafted,
      live,
    });
    expect(resolved.deckName).toBe('Deck 1');
    expect(resolved.eventName).toBe('Week 1');
    expect(resolved.status).toBe('submitted');
    expect(resolved.ownerDisplayName).toBe('Alice');
    expect(resolved.entries).toHaveLength(1);
    expect(resolved.entries[0]).toMatchObject({
      scryfallId: 'shock-1',
      name: 'Shock',
      setCode: 'M10',
      collectorNumber: '146',
    });
  });

  it('falls back to Deck N when live name is null', () => {
    const resolved = resolveMintSharePayload({
      viewerIsOwner: false,
      clientPayload: crafted,
      live: { ...live, name: null, orderIndex: 2 },
    });
    expect(resolved.deckName).toBe('Deck 3');
  });
});

describe('parseStoredSharePayload', () => {
  it('returns a canonical payload', () => {
    const parsed = parseStoredSharePayload(payload());
    expect(parsed.deckName).toBe('Deck 1');
    expect(parsed.entries).toHaveLength(2);
  });

  it('keeps optional setCode and collectorNumber from new shares and omits them when absent', () => {
    const withPrintings = parseStoredSharePayload(
      payload({
        entries: [
          entry({
            scryfallId: 'shock-1',
            zone: 'main',
            quantity: 2,
            setCode: 'M10',
            collectorNumber: '146',
          }),
        ],
      }),
    );
    expect(withPrintings.entries[0]).toMatchObject({
      scryfallId: 'shock-1',
      setCode: 'M10',
      collectorNumber: '146',
    });

    const legacy = parseStoredSharePayload(payload());
    expect(legacy.entries[0]).not.toHaveProperty('setCode');
    expect(legacy.entries[0]).not.toHaveProperty('collectorNumber');
  });

  it('throws INVALID_SHARE for garbage JSON', () => {
    try {
      parseStoredSharePayload({ v: 2 });
      throw new Error('expected AppError');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(404);
      expect((error as AppError).code).toBe('INVALID_SHARE');
    }
  });
});
