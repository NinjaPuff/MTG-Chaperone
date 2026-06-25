import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { CardNameWithFlavorSubtitle } from '@/components/cardpool/CardNameWithFlavorSubtitle';
import { HoverTarget } from '@/components/cardpool/CardPreviewContext';
import { ManaCostSymbols } from '@/components/cardpool/ManaCostSymbols';
import { PoolCardImage } from '@/components/cardpool/PoolCardImage';
import type { SearchResult } from '@/components/cardpool/types';
import { SetSymbol } from '@/components/SetSymbol';
import type { ScryfallSetSummary } from '@/hooks/useScryfallSets';
import { useSearchResultsKeyboard } from '@/hooks/useSearchResultsKeyboard';
import { getPrimaryCardImageUrl } from '@/lib/cardImage';
import {
  cardImageLandscapeRotationClassName,
  faceTypeLineFromCard,
  needsImageRotation,
} from '@/lib/cardLayout';
import { focusAndSelectInput } from '@/lib/focusSearchInputAfterStage';
import { cn } from '@/lib/utils';

function normalizeImageUris(imageUris: unknown): Record<string, string> | null {
  if (!imageUris || typeof imageUris !== 'object' || Array.isArray(imageUris)) {
    return null;
  }
  const entries = Object.entries(imageUris as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

type CardPoolSearchPanelProps = {
  phaseLabel: string;
  phaseOptions: string[];
  onPhaseLabelChange: (phaseLabel: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchResult[];
  searching: boolean;
  onStageCard: (card: SearchResult) => void;
  inputRef: RefObject<HTMLInputElement>;
  getSet?: (code: string) => ScryfallSetSummary | undefined;
};

export function CardPoolSearchPanel({
  phaseLabel,
  phaseOptions,
  onPhaseLabelChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searching,
  onStageCard,
  inputRef,
  getSet = () => undefined,
}: CardPoolSearchPanelProps) {
  const resultRefs = useRef<Array<HTMLDivElement | null>>([]);
  const showResults = !searching && searchResults.length > 0;

  const { activeIndex, handleInputKeyDown, handleResultMouseEnter, resetHighlight } =
    useSearchResultsKeyboard({
      resultCount: showResults ? searchResults.length : 0,
      onSelectIndex: (index) => {
        const card = searchResults[index];
        if (!card) {
          return;
        }
        onStageCard(card);
        focusAndSelectInput(inputRef.current);
      },
    });

  const stageCard = useCallback(
    (card: SearchResult) => {
      onStageCard(card);
      focusAndSelectInput(inputRef.current);
      resetHighlight();
    },
    [inputRef, onStageCard, resetHighlight],
  );

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }
    resultRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const handleSearchChange = (value: string) => {
    resetHighlight();
    onSearchQueryChange(value);
  };

  const activeDescendantId =
    activeIndex !== null && showResults ? `card-search-result-${searchResults[activeIndex]?.scryfallId}` : undefined;

  return (
    <form className="rounded-lg border border-border bg-card p-6 space-y-4" onSubmit={(event) => event.preventDefault()}>
      <h2 className="text-lg font-semibold">Add Cards</h2>

      <label className="block text-sm font-medium">
        Phase Label
        <select
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={phaseLabel}
          onChange={(event) => onPhaseLabelChange(event.target.value)}
        >
          {phaseOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Search Cards
        <input
          ref={inputRef}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={searchQuery}
          onChange={(event) => handleSearchChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search by card name..."
          aria-label="Search cards"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="card-search-results"
          aria-activedescendant={activeDescendantId}
          aria-autocomplete="list"
        />
      </label>

      {searching ? <p className="text-xs text-muted-foreground">Searching...</p> : null}

      {showResults ? (
        <div
          id="card-search-results"
          role="listbox"
          aria-label="Search results"
          className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border p-2"
        >
          {searchResults.map((card, index) => {
            const imageUris = normalizeImageUris(card.imageUris);
            const hoverImageUrl = getPrimaryCardImageUrl(imageUris, ['normal', 'small', 'border_crop']);
            const rotateLandscape = needsImageRotation(
              card.layout ?? null,
              faceTypeLineFromCard(card.typeLine, 0),
            );
            const isActive = activeIndex === index;

            return (
              <div
                key={card.scryfallId}
                id={`card-search-result-${card.scryfallId}`}
                ref={(element) => {
                  resultRefs.current[index] = element;
                }}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => handleResultMouseEnter(index)}
                onDoubleClick={() => stageCard(card)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-3 rounded border border-border p-2 hover:bg-muted',
                  isActive && 'bg-muted ring-2 ring-primary/40',
                )}
              >
                <HoverTarget
                  scryfallId={card.scryfallId}
                  name={card.name}
                  layout={card.layout ?? null}
                  typeLine={card.typeLine ?? null}
                  imageUrl={hoverImageUrl}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    {rotateLandscape ? (
                      <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted/40">
                        <PoolCardImage
                          name={card.name}
                          scryfallId={card.scryfallId}
                          imageUris={imageUris}
                          preference={['small', 'normal', 'border_crop']}
                          className={cardImageLandscapeRotationClassName()}
                          fallbackClassName="inline-flex h-full w-full items-center justify-center bg-muted px-1 text-center text-[9px] text-muted-foreground"
                        />
                      </div>
                    ) : (
                      <PoolCardImage
                        name={card.name}
                        scryfallId={card.scryfallId}
                        imageUris={imageUris}
                        preference={['small', 'normal', 'border_crop']}
                        className="h-14 w-10 shrink-0 rounded border border-border object-cover"
                        fallbackClassName="inline-flex h-14 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted px-1 text-center text-[9px] text-muted-foreground"
                      />
                    )}
                    <div className="min-w-0">
                      <CardNameWithFlavorSubtitle
                        name={card.name}
                        flavorName={card.flavorName}
                        nameClassName="truncate text-sm font-medium"
                      />
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <SetSymbol
                          setCode={card.setCode}
                          size="sm"
                          iconUri={getSet(card.setCode)?.icon_svg_uri}
                          setName={getSet(card.setCode)?.name}
                        />
                        <ManaCostSymbols manaCost={card.manaCost} className="inline-flex align-middle" />
                      </p>
                    </div>
                  </div>
                </HoverTarget>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-background"
                  onClick={() => stageCard(card)}
                >
                  Add
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Selected cards are staged below. Review staged changes, then apply when ready.
      </p>
    </form>
  );
}
