import { useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BasicLandAdderPopup } from './BasicLandAdderPopup';
import { DeckBuildDetailsToggle } from './DeckBuildDetailsToggle';
import { DeckCardList, type DeckCardListItem } from './DeckCardList';
import { MiniManaCurve } from './MiniManaCurve';
import type { BuilderDeck, DeckBuilderCard } from './types';
import type { SuggestBasicLandCard } from '@/lib/suggestBasicLands';

type DeckSidebarProps = {
  decks: BuilderDeck[];
  activeDeckId: string;
  minDeckSize: number;
  disabled?: boolean;
  onActiveDeckChange: (deckId: string) => void;
  onDeckNameChange: (deckId: string, name: string) => void;
  onCardClick: (card: DeckBuilderCard, deckId: string) => void;
  onCardContextMenu?: (event: MouseEvent, card: DeckBuilderCard, deckId: string) => void;
  onBasicLandsChange: (deckId: string, next: BuilderDeck['basicLands']) => void;
  onMainDeckDrop?: (event: DragEvent<HTMLDivElement>, deckId: string) => void;
  onSideboardDrop?: (event: DragEvent<HTMLDivElement>, deckId: string) => void;
  expandedDeckMode?: boolean;
  onExpandedDeckModeChange?: (expanded: boolean) => void;
  poolImageByCardId?: Map<string, string>;
};

function toListItems(
  cards: DeckBuilderCard[],
  zone: 'main' | 'sideboard',
  poolImageByCardId?: Map<string, string>,
): DeckCardListItem[] {
  return cards
    .filter((card) => card.zone === zone)
    .sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((card) => ({
      cachedCardId: card.cachedCardId,
      name: card.name,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      quantity: card.quantity,
      zone,
      colorIdentity: card.colorIdentity,
      imageUrl: poolImageByCardId?.get(card.cachedCardId) ?? null,
    }));
}

function toSuggestionCards(cards: DeckBuilderCard[]): SuggestBasicLandCard[] {
  return cards.map((card) => ({
    quantity: card.quantity,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity,
  }));
}

export function DeckSidebar({
  decks,
  activeDeckId,
  minDeckSize,
  disabled = false,
  onActiveDeckChange,
  onDeckNameChange,
  onCardClick,
  onCardContextMenu,
  onBasicLandsChange,
  onMainDeckDrop,
  onSideboardDrop,
  expandedDeckMode,
  onExpandedDeckModeChange,
  poolImageByCardId,
}: DeckSidebarProps) {
  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? decks[0];
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(activeDeck?.name ?? 'Deck');
  const [sideboardExpanded, setSideboardExpanded] = useState(true);

  const mainCards = useMemo(
    () => toListItems(activeDeck?.cards ?? [], 'main', poolImageByCardId),
    [activeDeck?.cards, poolImageByCardId],
  );
  const sideboardCards = useMemo(
    () => toListItems(activeDeck?.cards ?? [], 'sideboard', poolImageByCardId),
    [activeDeck?.cards, poolImageByCardId],
  );
  const mainCount = mainCards.reduce((sum, card) => sum + card.quantity, 0);
  const sideboardCount = sideboardCards.reduce((sum, card) => sum + card.quantity, 0);
  const curveCards = (activeDeck?.cards ?? [])
    .filter((card) => card.zone === 'main')
    .map((card) => ({ cmc: card.cmc, quantity: card.quantity, typeLine: card.typeLine }));

  if (!activeDeck) {
    return (
      <aside className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">No deck selected.</p>
      </aside>
    );
  }

  const saveDeckName = () => {
    setIsEditingName(false);
    if (draftName.trim() && draftName.trim() !== activeDeck.name) {
      onDeckNameChange(activeDeck.id, draftName.trim());
    }
  };

  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      saveDeckName();
    }
    if (event.key === 'Escape') {
      setDraftName(activeDeck.name);
      setIsEditingName(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-lg border border-primary/30 bg-muted/40 p-3 ring-1 ring-primary/10">
      <div className="mb-3 shrink-0 space-y-2 border-b border-border/70 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
          {decks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              className={`rounded border px-2 py-1 text-xs ${deck.id === activeDeck.id ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
              onClick={() => onActiveDeckChange(deck.id)}
            >
              {deck.name}
            </button>
          ))}
          </div>
          {onExpandedDeckModeChange ? (
            <DeckBuildDetailsToggle
              expandedDeckMode={expandedDeckMode ?? false}
              onChange={onExpandedDeckModeChange}
              disabled={disabled}
            />
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          {isEditingName ? (
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={saveDeckName}
              onKeyDown={onNameKeyDown}
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              autoFocus
              disabled={disabled}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(activeDeck.name);
                setIsEditingName(true);
              }}
              disabled={disabled}
              className="truncate text-left text-sm font-semibold hover:underline disabled:no-underline"
            >
              {activeDeck.name}
            </button>
          )}
          <span className="shrink-0 rounded bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
            {mainCount}/{minDeckSize}
          </span>
        </div>
      </div>

      <div className="shrink-0">
        <MiniManaCurve cards={curveCards} />
      </div>

      <div
        className="mt-3 flex min-h-0 flex-1 flex-col rounded-md border border-border/50 p-2"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onMainDeckDrop?.(event, activeDeck.id)}
      >
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          data-testid="deck-sidebar-main-scroll"
        >
          <DeckCardList
            title="Main Deck"
            emptyText="Drop cards here or click pool cards."
            cards={mainCards}
            onCardClick={(card) =>
              onCardClick(
                activeDeck.cards.find((entry) => entry.cachedCardId === card.cachedCardId && entry.zone === card.zone) ?? {
                  cachedCardId: card.cachedCardId,
                  name: card.name,
                  manaCost: card.manaCost,
                  typeLine: card.typeLine,
                  cmc: 0,
                  quantity: card.quantity,
                  zone: card.zone,
                  colorIdentity: [],
                },
                activeDeck.id,
              )
            }
            onCardContextMenu={(event, card) => {
              const target = activeDeck.cards.find((entry) => entry.cachedCardId === card.cachedCardId && entry.zone === card.zone);
              if (target) {
                onCardContextMenu?.(event, target, activeDeck.id);
              }
            }}
          />
        </div>
      </div>

      <div
        className={`mt-3 shrink-0 flex-col rounded-md border border-border/70 bg-background p-2 ${sideboardExpanded ? 'flex min-h-[4.5rem] max-h-[30vh]' : 'flex'}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onSideboardDrop?.(event, activeDeck.id)}
      >
        <button
          type="button"
          className="flex w-full shrink-0 items-center justify-between rounded px-1 py-0.5 text-left hover:bg-muted/50"
          onClick={() => setSideboardExpanded((prev) => !prev)}
          aria-expanded={sideboardExpanded}
          aria-controls="deck-sidebar-sideboard-panel"
        >
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sideboardExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Sideboard
          </span>
          <span className="rounded border border-border px-1.5 py-0.5 text-[11px]">{sideboardCount}</span>
        </button>
        {sideboardExpanded ? (
          <div
            id="deck-sidebar-sideboard-panel"
            className="mt-2 min-h-0 flex-1 overflow-y-auto"
            data-testid="deck-sidebar-sideboard-scroll"
          >
            <DeckCardList
              title="Cards"
              emptyText="Right-click pool cards to add."
              cards={sideboardCards}
              onCardClick={(card) =>
                onCardClick(
                  activeDeck.cards.find((entry) => entry.cachedCardId === card.cachedCardId && entry.zone === card.zone) ?? {
                    cachedCardId: card.cachedCardId,
                    name: card.name,
                    manaCost: card.manaCost,
                    typeLine: card.typeLine,
                    cmc: 0,
                    quantity: card.quantity,
                    zone: card.zone,
                    colorIdentity: [],
                  },
                  activeDeck.id,
                )
              }
              onCardContextMenu={(event, card) => {
                const target = activeDeck.cards.find((entry) => entry.cachedCardId === card.cachedCardId && entry.zone === card.zone);
                if (target) {
                  onCardContextMenu?.(event, target, activeDeck.id);
                }
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 shrink-0">
        <BasicLandAdderPopup
          counts={activeDeck.basicLands}
          minDeckSize={minDeckSize}
          deckCards={toSuggestionCards(activeDeck.cards)}
          onChange={(next) => onBasicLandsChange(activeDeck.id, next)}
          disabled={disabled}
        />
      </div>
    </aside>
  );
}

