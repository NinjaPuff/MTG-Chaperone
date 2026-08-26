import type { BasicLandSuggestion } from '@/lib/suggestBasicLands';

export type DeckBuilderCard = {
  cachedCardId: string;
  name: string;
  layout: string | null;
  manaCost: string | null;
  typeLine: string;
  cmc: number;
  quantity: number;
  zone: 'main' | 'sideboard';
  colorIdentity: string[];
  setCode?: string | null;
  collectorNumber?: string | null;
};

export type BuilderDeck = {
  id: string;
  orderIndex: number;
  name: string;
  status: 'draft' | 'submitted' | 'locked';
  cards: DeckBuilderCard[];
  basicLands: BasicLandSuggestion;
};

