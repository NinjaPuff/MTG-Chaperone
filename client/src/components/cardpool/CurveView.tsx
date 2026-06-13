import { type MouseEvent, type ReactNode } from 'react';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from './types';
import { HoverTarget, type TouchAction } from './CardPreviewContext';
import { GroupHeadingLabel } from './GroupHeadingLabel';
import { PoolCardImage } from './PoolCardImage';
import { sumBucketQuantity } from '@/lib/curveBucketTotal';
import { getPrimaryType, groupByCmc, groupByOrganize, groupByPhase, sortCards } from '@/lib/cardPoolSort';
import { getPrimaryCardImageUrl } from '@/lib/cardImage';
import { stackBadgeTopPx } from '@/lib/stackBadgeLayout';

type CurveViewProps = {
  cards: PoolCard[];
  sortKey: SortKey;
  groupMode: GroupMode;
  organizeBy: StacksOrganizeBy;
  cardWidth: number;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
};

function sortCurveColumn(cards: PoolCard[]) {
  return [...cards].sort((a, b) => {
    const aType = getPrimaryType(a.typeLine) === 'Creature' ? 0 : 1;
    const bType = getPrimaryType(b.typeLine) === 'Creature' ? 0 : 1;
    if (aType !== bType) {
      return aType - bType;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function CurveColumns({
  cards,
  cardWidth,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: {
  cards: PoolCard[];
  cardWidth: number;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
}) {
  const byCmc = groupByCmc(cards);
  const cardHeight = Math.round((cardWidth * 680) / 488);
  const peekHeight = Math.max(30, Math.round(cardHeight * 0.12));
  const columnWidth = cardWidth + 16;

  return (
    <div className="overflow-x-auto pb-3" data-testid="curve-columns-scroll">
      <div className="flex w-max min-w-full gap-3">
      {[...byCmc.entries()].map(([cmc, bucket]) => {
        const ordered = sortCurveColumn(bucket);
        const stackHeight = ordered.length > 0 ? (ordered.length - 1) * peekHeight + cardHeight + 4 : cardHeight;
        return (
          <div
            key={cmc}
            className="shrink-0 space-y-2 rounded-md border border-border/60 bg-card/30 p-2"
            style={{ width: columnWidth }}
          >
            <div className="text-center text-sm font-semibold">
              {cmc === 7 ? '7+' : cmc}{' '}
              <span className="text-muted-foreground">({sumBucketQuantity(ordered)})</span>
            </div>
            {ordered.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-muted-foreground">--</div>
            ) : (
              <div className="mx-auto" style={{ width: cardWidth }} data-testid="curve-card-wrapper">
                <div className="relative" style={{ height: stackHeight }}>
                  {ordered.map((card, index) => {
                    const image = getPrimaryCardImageUrl(card.imageUris, ['normal', 'border_crop', 'small']);
                    const isTop = index === ordered.length - 1;
                    const visibleHeight = isTop ? cardHeight : peekHeight;
                    const stackSliceClass = isTop
                      ? 'rounded-md border border-border'
                      : 'rounded-t-md rounded-b-none border-x border-t border-border';

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
                          className={`absolute left-0 right-0 overflow-hidden ${stackSliceClass}${onCardClick ? ' cursor-pointer' : ''}`}
                          style={{ top: index * peekHeight, height: visibleHeight }}
                          onContextMenu={onCardContextMenu ? (event) => onCardContextMenu(event, card) : undefined}
                          onClick={onCardClick ? () => onCardClick(card) : undefined}
                          onDoubleClick={onCardDoubleClick ? () => onCardDoubleClick(card) : undefined}
                        >
                          <PoolCardImage
                            name={card.name}
                            scryfallId={card.scryfallId}
                            imageUris={card.imageUris}
                            preference={['normal', 'border_crop', 'small']}
                            className={`h-full w-full bg-black object-contain object-top shadow-sm ${
                              isTop ? 'rounded-md' : 'rounded-t-md rounded-b-none'
                            }`}
                            fallbackClassName={`w-full border border-border bg-muted p-2 text-center text-xs text-muted-foreground ${
                              isTop ? 'rounded-md' : 'rounded-t-md rounded-b-none'
                            }`}
                            style={{ height: cardHeight }}
                          />
                          {card.quantity > 1 ? (
                            <span className="absolute right-1 top-1 rounded-full border border-white/35 bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              x{card.quantity}
                            </span>
                          ) : null}
                        </div>
                      </HoverTarget>
                    );
                  })}
                  {renderBadge
                    ? ordered.map((card, index) => (
                        <div
                          key={`badge-${card.phaseLabel}-${card.scryfallId}`}
                          data-badge-index={index}
                          data-testid="pool-card-badge-anchor"
                          className="pointer-events-none absolute left-1 z-10"
                          style={{ top: stackBadgeTopPx(index, peekHeight) }}
                        >
                          {renderBadge(card)}
                        </div>
                      ))
                    : null}
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function OrganizedCurveSections({
  cards,
  organizeBy,
  cardWidth,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: {
  cards: PoolCard[];
  organizeBy: StacksOrganizeBy;
  cardWidth: number;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
}) {
  if (organizeBy === 'cmc') {
    return (
      <CurveColumns
        cards={cards}
        cardWidth={cardWidth}
        onCardContextMenu={onCardContextMenu}
        onCardClick={onCardClick}
        onCardDoubleClick={onCardDoubleClick}
        renderBadge={renderBadge}
        getTouchActions={getTouchActions}
      />
    );
  }

  const groups = groupByOrganize(cards, organizeBy);
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([label, groupedCards]) => (
        <div key={label} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            <GroupHeadingLabel label={label} /> ({sumBucketQuantity(groupedCards)})
          </h3>
          <CurveColumns
            cards={groupedCards}
            cardWidth={cardWidth}
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

export function CurveView({
  cards,
  sortKey,
  groupMode,
  organizeBy,
  cardWidth,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: CurveViewProps) {
  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards added yet.</p>;
  }

  const sortedCards = sortCards(cards, sortKey);

  if (groupMode === 'flat') {
    return (
      <OrganizedCurveSections
        cards={sortedCards}
        organizeBy={organizeBy}
        cardWidth={cardWidth}
        onCardContextMenu={onCardContextMenu}
        onCardClick={onCardClick}
        onCardDoubleClick={onCardDoubleClick}
        renderBadge={renderBadge}
        getTouchActions={getTouchActions}
      />
    );
  }

  const byPhase = groupByPhase(sortedCards);
  return (
    <div className="space-y-6">
      {[...byPhase.entries()].map(([phase, phaseCards]) => (
        <div key={phase} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phase}</h3>
          <OrganizedCurveSections
            cards={phaseCards}
            organizeBy={organizeBy}
            cardWidth={cardWidth}
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
