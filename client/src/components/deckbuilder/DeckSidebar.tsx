import { useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { BasicLandAdderPopup } from './BasicLandAdderPopup';
import { DeckCardList, type DeckCardListItem } from './DeckCardList';
import { MiniManaCurve } from './MiniManaCurve';
import type { BuilderDeck, DeckBuilderCard } from './types';
import { extractSideboardBasicCounts } from '@/lib/deckBasicLands';
import type { BasicLandSuggestion, SuggestBasicLandCard } from '@/lib/suggestBasicLands';
import type { PrepDeckSize } from '@/lib/prepDeckSize';

type DeckSidebarProps = {
  decks: BuilderDeck[];
  activeDeckId: string;
  minDeckSize: number;
  disabled?: boolean;
  nameDisabled?: boolean;
  onDeckNameChange: (deckId: string, name: string) => void;
  onCardClick: (card: DeckBuilderCard, deckId: string) => void;
  onCardContextMenu?: (event: MouseEvent, card: DeckBuilderCard, deckId: string) => void;
  onBasicLandsChange: (deckId: string, next: BuilderDeck['basicLands']) => void;
  onSideboardBasicLandsChange: (deckId: string, next: BasicLandSuggestion) => void;
  onMainDeckDrop?: (event: DragEvent<HTMLDivElement>, deckId: string) => void;
  onSideboardDrop?: (event: DragEvent<HTMLDivElement>, deckId: string) => void;
  poolImageByCardId?: Map<string, string>;
  saveBlockedCardIdsByDeckId?: Record<string, string[]>;
  prepSizeToggle?: {
    value: PrepDeckSize;
    onChange: (size: PrepDeckSize) => void;
  };
};

function toListItems(
  cards: DeckBuilderCard[],
  zone: 'main' | 'sideboard',
  poolImageByCardId?: Map<string, string>,
  saveBlockedCardIds?: Set<string>,
): DeckCardListItem[] {
  return cards
    .filter((card) => card.zone === zone)
    .sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((card) => ({
      cachedCardId: card.cachedCardId,
      name: card.name,
      layout: card.layout ?? null,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      quantity: card.quantity,
      zone,
      colorIdentity: card.colorIdentity,
      imageUrl: poolImageByCardId?.get(card.cachedCardId) ?? null,
      hasSaveIssue: saveBlockedCardIds?.has(card.cachedCardId) ?? false,
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
  nameDisabled,
  onDeckNameChange,
  onCardClick,
  onCardContextMenu,
  onBasicLandsChange,
  onSideboardBasicLandsChange,
  onMainDeckDrop,
  onSideboardDrop,
  poolImageByCardId,
  saveBlockedCardIdsByDeckId = {},
  prepSizeToggle,
}: DeckSidebarProps) {
  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? decks[0];
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(activeDeck?.name ?? 'Deck');
  const [sideboardExpanded, setSideboardExpanded] = useState(false);

  const activeDeckSaveBlockedCardIds = useMemo(
    () => new Set(saveBlockedCardIdsByDeckId[activeDeck?.id ?? ''] ?? []),
    [activeDeck?.id, saveBlockedCardIdsByDeckId],
  );
  const mainCards = useMemo(
    () => toListItems(activeDeck?.cards ?? [], 'main', poolImageByCardId, activeDeckSaveBlockedCardIds),
    [activeDeck?.cards, poolImageByCardId, activeDeckSaveBlockedCardIds],
  );
  const sideboardCards = useMemo(
    () => toListItems(activeDeck?.cards ?? [], 'sideboard', poolImageByCardId, activeDeckSaveBlockedCardIds),
    [activeDeck?.cards, poolImageByCardId, activeDeckSaveBlockedCardIds],
  );
  const mainCount = mainCards.reduce((sum, card) => sum + card.quantity, 0);
  const sideboardCount = sideboardCards.reduce((sum, card) => sum + card.quantity, 0);
  const sideboardBasicCounts = useMemo(
    () => extractSideboardBasicCounts(activeDeck?.cards ?? []),
    [activeDeck?.cards],
  );
  const curveCards = useMemo(
    () =>
      (activeDeck?.cards ?? [])
        .filter((card) => card.zone === 'main')
        .map((card) => ({ cmc: card.cmc, quantity: card.quantity, typeLine: card.typeLine })),
    [activeDeck?.cards],
  );

  if (!activeDeck) {
    return (
      <aside className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">No deck selected.</p>
      </aside>
    );
  }

  const renameDisabled = nameDisabled ?? disabled;

  const startEditingName = () => {
    setDraftName(activeDeck.name);
    setIsEditingName(true);
  };

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
    <aside className="flex h-full min-h-0 flex-col rounded-lg border border-primary/30 bg-muted/40 p-2 ring-1 ring-primary/10">
      <div className="mb-1.5 shrink-0 border-b border-border/70 pb-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {isEditingName ? (
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={saveDeckName}
                onKeyDown={onNameKeyDown}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                autoFocus
                disabled={renameDisabled}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={startEditingName}
                  disabled={renameDisabled}
                  title={renameDisabled ? undefined : 'Click to rename deck'}
                  className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-100"
                >
                  {activeDeck.name}
                </button>
                {!renameDisabled ? (
                  <button
                    type="button"
                    data-testid="deck-rename-button"
                    aria-label={`Rename ${activeDeck.name}`}
                    title="Rename deck"
                    onClick={startEditingName}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </>
            )}
          </div>
          <div className="shrink-0 text-right">
            <span className="rounded bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
              {mainCount}/{minDeckSize}
            </span>
            {prepSizeToggle ? (
              <div className="mt-1 flex justify-end gap-1" data-testid="deck-sidebar-prep-size-toggle">
                {[40, 60].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${
                      prepSizeToggle.value === size ? 'border-primary bg-primary/10 text-primary' : 'border-border'
                    }`}
                    onClick={() => prepSizeToggle.onChange(size as PrepDeckSize)}
                    disabled={disabled}
                  >
                    {size}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-1.5 shrink-0" data-testid="deck-sidebar-mana-curve">
        <MiniManaCurve cards={curveCards} compact />
      </div>

      <div
        className="mt-1.5 flex min-h-0 flex-1 flex-col rounded-md border border-border/50 p-1.5"
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
                  layout: card.layout ?? null,
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
        className={`mt-2 shrink-0 flex-col rounded-md border border-border/70 bg-background p-1.5 ${sideboardExpanded ? 'flex min-h-[4.5rem] max-h-[30vh]' : 'flex'}`}
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
                    layout: card.layout ?? null,
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

      <div className="mt-2 shrink-0">
        <BasicLandAdderPopup
          mainCounts={activeDeck.basicLands}
          sideboardCounts={sideboardBasicCounts}
          minDeckSize={minDeckSize}
          mainDeckCards={toSuggestionCards(activeDeck.cards.filter((c) => c.zone === 'main'))}
          onMainChange={(next) => onBasicLandsChange(activeDeck.id, next)}
          onSideboardChange={(next) => onSideboardBasicLandsChange(activeDeck.id, next)}
          disabled={disabled}
        />
      </div>
    </aside>
  );
}
