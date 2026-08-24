import { describe, expect, it } from 'vitest';
import { seasonDecklistToBuilderDeck, type SeasonArchiveDecklist } from '../../lib/archiveDeck';

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
      },
    ]);
  });
});
