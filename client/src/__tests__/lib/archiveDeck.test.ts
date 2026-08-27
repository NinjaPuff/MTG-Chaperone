import { describe, expect, it, vi } from 'vitest';
import type { DeckSharePayload } from '@mtg-league/shared';
import {
  hydrateDeckSharePayload,
  seasonDecklistToBuilderDeck,
  snapshotToBuilderDeck,
  type SeasonArchiveDecklist,
} from '../../lib/archiveDeck';

describe('seasonDecklistToBuilderDeck', () => {
  it('maps season list entries to a BuilderDeck with defaults for missing card fields', () => {
    const decklist: SeasonArchiveDecklist = {
      id: 'deck-null-name',
      orderIndex: 2,
      name: null,
      status: 'locked',
      entries: [
        {
          id: 'm1',
          quantity: 2,
          zone: 'main',
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
        },
        {
          id: 's1',
          quantity: 1,
          zone: 'sideboard',
          cachedCard: {
            scryfallId: 'negate-1',
            name: 'Negate',
          },
        },
      ],
    };

    const deck = seasonDecklistToBuilderDeck(decklist);

    expect(deck.id).toBe('deck-null-name');
    expect(deck.orderIndex).toBe(2);
    expect(deck.name).toBe('Deck 3');
    expect(deck.status).toBe('locked');
    expect(deck.basicLands).toEqual({
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    });

    expect(deck.cards).toEqual([
      {
        cachedCardId: 'shock-1',
        name: 'Shock',
        layout: 'normal',
        manaCost: '{R}',
        typeLine: 'Instant',
        cmc: 1,
        quantity: 2,
        zone: 'main',
        colorIdentity: ['R'],
        setCode: 'M10',
        collectorNumber: '146',
      },
      {
        cachedCardId: 'negate-1',
        name: 'Negate',
        layout: null,
        manaCost: null,
        typeLine: '',
        cmc: 0,
        quantity: 1,
        zone: 'sideboard',
        colorIdentity: [],
        setCode: null,
        collectorNumber: null,
      },
    ]);
  });
});

describe('snapshotToBuilderDeck', () => {
  it('maps codec fields onto a BuilderDeck with a placeholder id and defaults', () => {
    const snapshot: DeckSharePayload = {
      v: 1,
      ownerDisplayName: 'Alice',
      deckName: 'Grixis',
      eventName: 'Week 1',
      roundNumber: 2,
      status: 'submitted',
      entries: [
        {
          scryfallId: 'shock-1',
          quantity: 2,
          zone: 'main',
          name: 'Shock',
          layout: 'normal',
          manaCost: '{R}',
          typeLine: 'Instant',
          cmc: 1,
          colorIdentity: ['R'],
          setCode: 'M10',
          collectorNumber: '146',
        },
        {
          scryfallId: 'negate-1',
          quantity: 1,
          zone: 'sideboard',
          name: 'Negate',
          layout: null,
          manaCost: null,
          typeLine: '',
          cmc: 0,
          colorIdentity: [],
        },
      ],
    };

    const deck = snapshotToBuilderDeck(snapshot);

    expect(deck.id).toBe('share');
    expect(deck.id).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(deck.orderIndex).toBe(0);
    expect(deck.name).toBe('Grixis');
    expect(deck.status).toBe('submitted');
    expect(deck.cards).toEqual([
      {
        cachedCardId: 'shock-1',
        name: 'Shock',
        layout: 'normal',
        manaCost: '{R}',
        typeLine: 'Instant',
        cmc: 1,
        quantity: 2,
        zone: 'main',
        colorIdentity: ['R'],
        setCode: 'M10',
        collectorNumber: '146',
      },
      {
        cachedCardId: 'negate-1',
        name: 'Negate',
        layout: null,
        manaCost: null,
        typeLine: '',
        cmc: 0,
        quantity: 1,
        zone: 'sideboard',
        colorIdentity: [],
        setCode: null,
        collectorNumber: null,
      },
    ]);
  });
});

describe('hydrateDeckSharePayload', () => {
  it('fills display fields from the card cache and skips fetches when names are already present', async () => {
    const slim: DeckSharePayload = {
      v: 1,
      ownerDisplayName: 'Alice',
      deckName: 'Grixis',
      eventName: 'Week 1',
      roundNumber: 2,
      status: 'submitted',
      entries: [
        {
          scryfallId: 'shock-1',
          quantity: 2,
          zone: 'main',
          name: '',
          layout: null,
          manaCost: null,
          typeLine: '',
          cmc: 0,
          colorIdentity: [],
        },
        {
          scryfallId: 'shock-1',
          quantity: 1,
          zone: 'sideboard',
          name: '',
          layout: null,
          manaCost: null,
          typeLine: '',
          cmc: 0,
          colorIdentity: [],
        },
      ],
    };
    const loadCard = vi.fn(async () => ({
      name: 'Shock',
      layout: 'normal',
      manaCost: '{R}',
      typeLine: 'Instant',
      cmc: 1,
      colorIdentity: ['R'],
      setCode: 'M10',
      collectorNumber: '146',
    }));

    const hydrated = await hydrateDeckSharePayload(slim, loadCard);
    expect(loadCard).toHaveBeenCalledTimes(1);
    expect(hydrated.entries[0]).toMatchObject({
      name: 'Shock',
      manaCost: '{R}',
      typeLine: 'Instant',
      zone: 'main',
      setCode: 'M10',
      collectorNumber: '146',
    });
    expect(hydrated.entries[1]).toMatchObject({ name: 'Shock', zone: 'sideboard' });

    const namedWithPrintings = await hydrateDeckSharePayload(
      {
        ...slim,
        entries: [{ ...slim.entries[0], name: 'Shock', setCode: 'M10', collectorNumber: '146' }],
      },
      loadCard,
    );
    expect(loadCard).toHaveBeenCalledTimes(1);
    expect(namedWithPrintings.entries[0]?.name).toBe('Shock');

    const namedWithoutPrintings = await hydrateDeckSharePayload(
      { ...slim, entries: [{ ...slim.entries[0], name: 'Shock' }] },
      loadCard,
    );
    expect(loadCard).toHaveBeenCalledTimes(2);
    expect(namedWithoutPrintings.entries[0]).toMatchObject({
      name: 'Shock',
      setCode: 'M10',
      collectorNumber: '146',
    });
  });
});
