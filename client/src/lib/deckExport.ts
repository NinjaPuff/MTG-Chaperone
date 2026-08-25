import type { DeckBuilderCard } from '@/components/deckbuilder/types';
import {
  formatArchidektDecklistText,
  formatMoxfieldDecklistText,
  type DeckExportEntry,
} from '@mtg-league/shared';

export type DeckExportFlavor = 'moxfield' | 'archidekt';

export function toDeckExportEntries(cards: DeckBuilderCard[]): DeckExportEntry[] {
  return cards.map((card) => ({
    quantity: card.quantity,
    name: card.name,
    setCode: card.setCode ?? null,
    collectorNumber: card.collectorNumber ?? null,
    zone: card.zone,
  }));
}

export function formatDeckExport(cards: DeckBuilderCard[], flavor: DeckExportFlavor): string {
  const entries = toDeckExportEntries(cards);
  return flavor === 'archidekt'
    ? formatArchidektDecklistText(entries)
    : formatMoxfieldDecklistText(entries);
}

export function deckExportFilename(deckName: string): string {
  const safe = deckName.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'deck';
  return `${safe}.txt`;
}

export function downloadDeckExport(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
