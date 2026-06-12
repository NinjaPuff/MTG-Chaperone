import type { BuilderDeck } from './types';

function formatDeckOptionLabel(deck: BuilderDeck) {
  if (deck.status === 'locked') {
    return `${deck.name} (Locked)`;
  }
  if (deck.status === 'submitted') {
    return `${deck.name} (Registered)`;
  }
  return deck.name;
}

type DeckTabListProps = {
  decks: BuilderDeck[];
  activeDeckId: string;
  onActiveDeckChange: (deckId: string) => void;
  disabled?: boolean;
};

export function DeckTabList({
  decks,
  activeDeckId,
  onActiveDeckChange,
  disabled = false,
}: DeckTabListProps) {
  return (
    <select
      data-testid="deck-tab-list"
      value={activeDeckId}
      disabled={disabled || decks.length === 0}
      onChange={(event) => onActiveDeckChange(event.target.value)}
      className="h-7 w-44 shrink-0 truncate rounded border border-border bg-background px-2 text-xs"
      aria-label="Select deck"
    >
      {decks.map((deck) => (
        <option key={deck.id} value={deck.id} data-testid={`deck-tab-${deck.id}`}>
          {formatDeckOptionLabel(deck)}
        </option>
      ))}
    </select>
  );
}
