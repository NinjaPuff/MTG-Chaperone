import type { BuilderDeck } from './types';

const ACTIVE_TAB_CLASS = 'border-primary bg-primary/10';
const INACTIVE_TAB_CLASS = 'border-border bg-background';

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
    <div className="flex flex-wrap items-center gap-1" data-testid="deck-tab-list">
      {decks.map((deck) => (
        <button
          key={deck.id}
          type="button"
          data-testid={`deck-tab-${deck.id}`}
          disabled={disabled}
          className={`rounded border px-1.5 py-0.5 text-xs ${
            deck.id === activeDeckId ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS
          }`}
          onClick={() => onActiveDeckChange(deck.id)}
        >
          {deck.name}
        </button>
      ))}
    </div>
  );
}
