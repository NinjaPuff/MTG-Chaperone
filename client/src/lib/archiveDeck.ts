import type { BuilderDeck } from '@/components/deckbuilder/types';
import { getDefaultBasicLandCounts } from '@/lib/deckBasicLands';
import type { DeckSharePayload } from '@mtg-league/shared';

export type SeasonArchiveCachedCard = {
  scryfallId: string;
  name: string;
  layout?: string | null;
  manaCost?: string | null;
  typeLine?: string | null;
  cmc?: number | null;
  colorIdentity?: string[] | null;
  setCode?: string | null;
  collectorNumber?: string | null;
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
      setCode: entry.cachedCard.setCode ?? null,
      collectorNumber: entry.cachedCard.collectorNumber ?? null,
    })),
  };
}

export function snapshotToBuilderDeck(snapshot: DeckSharePayload): BuilderDeck {
  return {
    id: 'share',
    orderIndex: 0,
    name: snapshot.deckName,
    status: snapshot.status,
    basicLands: getDefaultBasicLandCounts(),
    cards: snapshot.entries.map((entry) => ({
      cachedCardId: entry.scryfallId,
      name: entry.name,
      layout: entry.layout ?? null,
      manaCost: entry.manaCost ?? null,
      typeLine: entry.typeLine ?? '',
      cmc: entry.cmc ?? 0,
      quantity: entry.quantity,
      zone: entry.zone,
      colorIdentity: entry.colorIdentity ?? [],
      setCode: entry.setCode ?? null,
      collectorNumber: entry.collectorNumber ?? null,
    })),
  };
}

export type ShareCardRecord = {
  name?: string | null;
  layout?: string | null;
  manaCost?: string | null;
  typeLine?: string | null;
  cmc?: number | null;
  colorIdentity?: string[] | null;
  setCode?: string | null;
  collectorNumber?: string | null;
};

export async function hydrateDeckSharePayload(
  snapshot: DeckSharePayload,
  loadCard: (scryfallId: string) => Promise<ShareCardRecord | null>,
): Promise<DeckSharePayload> {
  if (snapshot.entries.every((entry) => entry.name && entry.setCode)) {
    return snapshot;
  }
  const ids = [...new Set(snapshot.entries.map((entry) => entry.scryfallId))];
  const records = new Map<string, ShareCardRecord>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const record = await loadCard(id);
        if (record) {
          records.set(id, record);
        }
      } catch {
        // Keep a placeholder name so the list still renders.
      }
    }),
  );
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) => {
      const record = records.get(entry.scryfallId);
      if (!record) {
        return { ...entry, name: entry.name || entry.scryfallId };
      }
      return {
        ...entry,
        name: record.name?.trim() || entry.name || entry.scryfallId,
        layout: record.layout ?? entry.layout ?? null,
        manaCost: record.manaCost ?? entry.manaCost ?? null,
        typeLine: record.typeLine ?? entry.typeLine ?? '',
        cmc: record.cmc ?? entry.cmc ?? 0,
        colorIdentity: record.colorIdentity ?? entry.colorIdentity ?? [],
        ...(record.setCode != null && record.setCode !== ''
          ? { setCode: record.setCode }
          : entry.setCode
            ? { setCode: entry.setCode }
            : {}),
        ...(record.collectorNumber != null && record.collectorNumber !== ''
          ? { collectorNumber: record.collectorNumber }
          : entry.collectorNumber
            ? { collectorNumber: entry.collectorNumber }
            : {}),
      };
    }),
  };
}

export function toDeckSharePayload(input: {
  ownerDisplayName: string;
  deckName: string;
  eventName: string;
  roundNumber: number;
  status: DeckSharePayload['status'];
  cards: BuilderDeck['cards'];
}): DeckSharePayload {
  return {
    v: 1,
    ownerDisplayName: input.ownerDisplayName,
    deckName: input.deckName,
    eventName: input.eventName,
    roundNumber: input.roundNumber,
    status: input.status,
    entries: input.cards.map((card) => ({
      scryfallId: card.cachedCardId,
      quantity: card.quantity,
      zone: card.zone,
      name: card.name,
      layout: card.layout,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      cmc: card.cmc,
      colorIdentity: card.colorIdentity,
      setCode: card.setCode ?? null,
      collectorNumber: card.collectorNumber ?? null,
    })),
  };
}
