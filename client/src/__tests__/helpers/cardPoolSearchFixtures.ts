import type { SearchResult } from '@/components/cardpool/types';

export function makeSearchResult(overrides?: Partial<SearchResult>): SearchResult {
  return {
    scryfallId: 'sf-1',
    name: 'Lightning Bolt',
    layout: null,
    setCode: 'LEA',
    imageUris: { small: 'https://example.com/bolt.jpg' },
    manaCost: '{R}',
    typeLine: 'Instant',
    ...overrides,
  };
}

export const threeSearchResults: SearchResult[] = [
  makeSearchResult({ scryfallId: 'sf-1', name: 'Lightning Bolt' }),
  makeSearchResult({ scryfallId: 'sf-2', name: 'Shock' }),
  makeSearchResult({ scryfallId: 'sf-3', name: 'Giant Growth' }),
];
