import type { MouseEvent } from 'react';
import { ManaCostSymbols } from '@/components/cardpool/ManaCostSymbols';
import { getPrimaryType } from '@/lib/cardPoolSort';

export type DeckCardListItem = {
  cachedCardId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  quantity: number;
  zone: 'main' | 'sideboard';
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
      {cards.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p> : null}
      <div className="mt-2 space-y-2">
        {Object.entries(grouped).map(([group, groupCards]) => (
          <div key={group} className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">{group}</p>
            {groupCards.map((card) => (
              <button
                key={`${card.cachedCardId}-${card.zone}`}
                type="button"
                className="flex w-full items-center justify-between rounded border border-border/60 px-2 py-1 text-left text-xs hover:bg-muted"
                onClick={() => onCardClick?.(card)}
                onContextMenu={(event) => onCardContextMenu?.(event, card)}
              >
                <span className="min-w-0 truncate">
                  {card.quantity}x {card.name}
                </span>
                <ManaCostSymbols manaCost={card.manaCost} className="ml-2 inline-flex shrink-0" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

