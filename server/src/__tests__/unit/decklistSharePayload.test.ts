import { describe, expect, it } from 'vitest';
import type { DeckSharePayload } from '@mtg-league/shared';
import { AppError } from '../../middleware/errorHandler.js';
import {
  hashShareContents,
  parseStoredSharePayload,
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

    expect(hashShareContents(shuffled)).toBe(hashShareContents(payload()));
    expect(hashShareContents(payload())).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when cards, name, event, round, or status change', () => {
    const base = hashShareContents(payload());
    expect(hashShareContents(payload({ deckName: 'Deck 2' }))).not.toBe(base);
    expect(hashShareContents(payload({ eventName: 'Week 2' }))).not.toBe(base);
    expect(hashShareContents(payload({ roundNumber: 2 }))).not.toBe(base);
    expect(hashShareContents(payload({ status: 'submitted' }))).not.toBe(base);
    expect(
      hashShareContents(
        payload({
          entries: [entry({ scryfallId: 'shock-1', zone: 'main', quantity: 3 })],
        }),
      ),
    ).not.toBe(base);
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
