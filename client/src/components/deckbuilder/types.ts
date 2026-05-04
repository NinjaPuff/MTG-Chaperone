import type { BasicLandSuggestion } from '@/lib/suggestBasicLands';

export type DeckBuilderCard = {
  cachedCardId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  cmc: number;
  quantity: number;
  zone: 'main' | 'sideboard';
  colorIdentity: string[];
};

export type BuilderDeck = {
  id: string;
  orderIndex: number;
  name: string;
  status: 'draft' | 'submitted' | 'locked';
  cards: DeckBuilderCard[];
  basicLands: BasicLandSuggestion;
};

