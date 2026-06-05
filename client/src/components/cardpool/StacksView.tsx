import type { MouseEvent, ReactNode } from 'react';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from './types';
import { HoverTarget, type TouchAction } from './CardPreviewContext';
import { GroupHeadingLabel } from './GroupHeadingLabel';
import { getImageUrl, groupByOrganize, groupByPhase, sortCards } from '@/lib/cardPoolSort';
import { stackBadgeTopPx } from '@/lib/stackBadgeLayout';

type StacksViewProps = {
  cards: PoolCard[];
  sortKey: SortKey;
  groupMode: GroupMode;
  cardWidth: number;
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
};

function StackColumn({
  typeLabel,
  cards,
  cardWidth,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: {
  typeLabel: string;
  cards: PoolCard[];
  cardWidth: number;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
}) {
  const cardHeight = Math.round((cardWidth * 680) / 488);
  const peekHeight = Math.max(48, Math.round(cardHeight * 0.24));
  const stackHeight = cards.length > 0 ? (cards.length - 1) * peekHeight + cardHeight + 2 : cardHeight;

  return (
    <div style={{ width: cardWidth }}>
      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
        <GroupHeadingLabel label={typeLabel} /> ({cards.reduce((sum, card) => sum + card.quantity, 0)})
      </h4>
      <div className="relative" style={{ height: stackHeight }}>
        {cards.map((card, index) => {
          const image = getImageUrl(card, 'border_crop') ?? getImageUrl(card, 'normal');
          return (
            <HoverTarget
              key={`${card.phaseLabel}-${card.scryfallId}`}
              scryfallId={card.scryfallId}
              name={card.name}
              layout={card.layout}
              imageUrl={image}
              touchActions={getTouchActions?.(card)}
              element="div"
            >
              <div
                className={`absolute left-0 right-0 overflow-hidden rounded-md${onCardClick ? ' cursor-pointer' : ''}`}
                style={{
                  top: index * peekHeight,
                  height: index === cards.length - 1 ? cardHeight : peekHeight,
                }}
                onContextMenu={onCardContextMenu ? (event) => onCardContextMenu(event, card) : undefined}
                onClick={onCardClick ? () => onCardClick(card) : undefined}
                onDoubleClick={onCardDoubleClick ? () => onCardDoubleClick(card) : undefined}
              >
                {image ? (
                  <img
                    src={image}
                    alt={card.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full rounded-md border border-border object-cover object-top shadow-sm"
                    style={{ height: cardHeight }}
                  />
                ) : (
                  <div
                    className="w-full rounded-md border border-border bg-muted p-2 text-center text-xs text-muted-foreground"
                    style={{ height: cardHeight }}
                  >
                    {card.name}
                  </div>
                )}
                <div className="absolute inset-x-2 top-2 text-[11px] font-medium leading-tight text-transparent select-text">
                  {card.name}
                  {card.manaCost ? ` ${card.manaCost}` : ''}
                </div>
                {card.quantity > 1 ? (
                  <span className="absolute right-1.5 top-7 rounded-full border border-white/35 bg-black/90 px-2 py-0.5 text-sm font-bold text-white shadow-sm">
                    x{card.quantity}
                  </span>
                ) : null}
              </div>
            </HoverTarget>
          );
        })}
        {renderBadge
          ? cards.map((card, index) => (
              <div
                key={`badge-${card.phaseLabel}-${card.scryfallId}`}
                data-badge-index={index}
                className="pointer-events-none absolute left-1 z-10"
                style={{ top: stackBadgeTopPx(index, peekHeight) }}
              >
                {renderBadge(card)}
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function StacksBlock({
  cards,
  sortKey,
  cardWidth,
  organizeBy,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: {
  cards: PoolCard[];
  sortKey: SortKey;
  cardWidth: number;
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
}) {
  const grouped = groupByOrganize(cards, organizeBy);

  return (
    <div className="flex flex-wrap items-start gap-4">
      {[...grouped.entries()].map(([label, groupedCards]) => (
        <StackColumn
          key={label}
          typeLabel={label}
          cards={sortCards(groupedCards, sortKey)}
          cardWidth={cardWidth}
          onCardContextMenu={onCardContextMenu}
          onCardClick={onCardClick}
          onCardDoubleClick={onCardDoubleClick}
          renderBadge={renderBadge}
          getTouchActions={getTouchActions}
        />
      ))}
    </div>
  );
}

export function StacksView({
  cards,
  sortKey,
  groupMode,
  cardWidth,
  organizeBy,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: StacksViewProps) {
  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards added yet.</p>;
  }

  if (groupMode === 'flat') {
    return (
      <StacksBlock
        cards={cards}
        sortKey={sortKey}
        cardWidth={cardWidth}
        organizeBy={organizeBy}
        onCardContextMenu={onCardContextMenu}
        onCardClick={onCardClick}
        onCardDoubleClick={onCardDoubleClick}
        renderBadge={renderBadge}
        getTouchActions={getTouchActions}
      />
    );
  }

  const byPhase = groupByPhase(cards);

  return (
    <div className="space-y-6">
      {[...byPhase.entries()].map(([phase, phaseCards]) => (
        <div key={phase} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phase}</h3>
          <StacksBlock
            cards={phaseCards}
            sortKey={sortKey}
            cardWidth={cardWidth}
            organizeBy={organizeBy}
            onCardContextMenu={onCardContextMenu}
            onCardClick={onCardClick}
            onCardDoubleClick={onCardDoubleClick}
            renderBadge={renderBadge}
            getTouchActions={getTouchActions}
          />
        </div>
      ))}
    </div>
  );
}
