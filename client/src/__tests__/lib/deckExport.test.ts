import { describe, expect, it } from 'vitest';
import type { DeckBuilderCard } from '@/components/deckbuilder/types';
import { deckExportFilename, formatDeckExport } from '../../lib/deckExport';

const cards: DeckBuilderCard[] = [
  {
    cachedCardId: 'island-1',
    name: 'Island',
    layout: 'normal',
    manaCost: null,
    typeLine: 'Basic Land — Island',
    cmc: 0,
    quantity: 4,
    zone: 'main',
    colorIdentity: ['U'],
    setCode: 'USG',
    collectorNumber: '335',
  },
  {
    cachedCardId: 'hydro-1',
    name: 'Hydroblast',
    layout: 'normal',
    manaCost: '{U}',
    typeLine: 'Instant',
    cmc: 1,
    quantity: 2,
    zone: 'sideboard',
    colorIdentity: ['U'],
    setCode: 'ICE',
    collectorNumber: '72',
  },
];

describe('formatDeckExport', () => {
  it('formats Moxfield text with printings and Archidekt Nx lines from builder cards', () => {
    expect(formatDeckExport(cards, 'moxfield')).toBe(
      ['Deck', '4 Island (USG) 335', '', 'Sideboard', '2 Hydroblast (ICE) 72'].join('\n'),
    );
    expect(formatDeckExport(cards, 'archidekt')).toContain('4x Island (USG) 335');
  });
});

describe('deckExportFilename', () => {
  it('sanitizes the deck name and falls back to deck.txt', () => {
    expect(deckExportFilename('Alice / Aggro')).toBe('Alice Aggro.txt');
    expect(deckExportFilename('   ')).toBe('deck.txt');
  });
});
