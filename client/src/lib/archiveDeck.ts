import type { BuilderDeck } from '@/components/deckbuilder/types';
import { getDefaultBasicLandCounts } from '@/lib/deckBasicLands';

export type SeasonArchiveCachedCard = {
  scryfallId: string;
  name: string;
  layout?: string | null;
  manaCost?: string | null;
  typeLine?: string | null;
  cmc?: number | null;
  colorIdentity?: string[] | null;
};

export type SeasonArchiveDecklist = {
  id: string;
  orderIndex: number;
  name: string | null;
  status: 'draft' | 'submitted' | 'locked';
  entries: Array<{
    id: string;
    quantity: number;
    zone: 'main' | 'sideboard';
    cachedCard: SeasonArchiveCachedCard;
  }>;
};

export function seasonDecklistToBuilderDeck(decklist: SeasonArchiveDecklist): BuilderDeck {
  return {
    id: decklist.id,
    orderIndex: decklist.orderIndex,
    name: decklist.name ?? `Deck ${decklist.orderIndex + 1}`,
    status: decklist.status,
    basicLands: getDefaultBasicLandCounts(),
    cards: decklist.entries.map((entry) => ({
      cachedCardId: entry.cachedCard.scryfallId,
      name: entry.cachedCard.name,
      layout: entry.cachedCard.layout ?? null,
      manaCost: entry.cachedCard.manaCost ?? null,
      typeLine: entry.cachedCard.typeLine ?? '',
      cmc: entry.cachedCard.cmc ?? 0,
      quantity: entry.quantity,
      zone: entry.zone,
      colorIdentity: entry.cachedCard.colorIdentity ?? [],
    })),
  };
}
