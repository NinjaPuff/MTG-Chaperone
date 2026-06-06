import type { MouseEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { HoverTarget } from '@/components/cardpool/CardPreviewContext';
import { ManaCostSymbols } from '@/components/cardpool/ManaCostSymbols';
import { sumBucketQuantity } from '@/lib/curveBucketTotal';
import { frontFaceManaCost, frontFaceName } from '@/lib/cardLayout';
import { getDeckRowColorClasses } from '@/lib/deckRowColors';
import { CARD_TYPE_ORDER, getPrimaryType } from '@/lib/cardPoolSort';

export type DeckCardListItem = {
  cachedCardId: string;
  name: string;
  layout: string | null;
  manaCost: string | null;
  typeLine: string;
  quantity: number;
  zone: 'main' | 'sideboard';
  colorIdentity: string[];
  imageUrl?: string | null;
  hasSaveIssue?: boolean;
};

type DeckCardListProps = {
  cards: DeckCardListItem[];
  title: string;
  emptyText: string;
  onCardClick?: (card: DeckCardListItem) => void;
  onCardContextMenu?: (event: MouseEvent, card: DeckCardListItem) => void;
  className?: string;
};

export function DeckCardList({
  cards,
  title,
  emptyText,
  onCardClick,
  onCardContextMenu,
  className,
}: DeckCardListProps) {
  const grouped = cards.reduce<Record<string, DeckCardListItem[]>>((acc, card) => {
    const key = getPrimaryType(card.typeLine);
    const bucket = acc[key] ?? [];
    bucket.push(card);
    acc[key] = bucket;
    return acc;
  }, {});

  return (
    <div className={className}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {cards.length === 0 ? <p className="mt-1.5 text-xs text-muted-foreground">{emptyText}</p> : null}
      <div className="mt-1.5 space-y-1.5">
        {CARD_TYPE_ORDER.filter((group) => grouped[group]?.length).map((group) => {
          const groupCards = grouped[group];
          return (
          <div key={group} className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {group} ({sumBucketQuantity(groupCards)})
            </p>
            {groupCards.map((card) => {
              const displayName = frontFaceName(card.name, card.layout);
              return (
                <button
                  key={`${card.cachedCardId}-${card.zone}`}
                  type="button"
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${getDeckRowColorClasses(card.colorIdentity)}`}
                  onClick={() => onCardClick?.(card)}
                  onContextMenu={(event) => onCardContextMenu?.(event, card)}
                >
                  <span className="min-w-0 truncate">
                    {card.quantity}x{' '}
                    <HoverTarget
                      scryfallId={card.cachedCardId}
                      name={displayName}
                      layout={card.layout}
                      imageUrl={card.imageUrl ?? null}
                    >
                      <span className="cursor-default">{displayName}</span>
                    </HoverTarget>
                    {card.hasSaveIssue ? (
                      <AlertTriangle
                        className="ml-1 inline h-3.5 w-3.5 align-text-bottom text-destructive"
                        aria-hidden="true"
                        title="Save blocked by this card"
                      />
                    ) : null}
                  </span>
                  <ManaCostSymbols
                    manaCost={frontFaceManaCost(card.manaCost, card.layout)}
                    className="ml-2 inline-flex shrink-0"
                  />
                </button>
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );
}

