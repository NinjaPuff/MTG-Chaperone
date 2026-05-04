import { type MouseEvent, useEffect, useRef, useState } from 'react';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from './types';
import { HoverTarget } from './CardPreviewContext';
import { GroupHeadingLabel } from './GroupHeadingLabel';
import { getImageUrl, getPrimaryType, groupByCmc, groupByOrganize, groupByPhase, sortCards } from '@/lib/cardPoolSort';

type CurveViewProps = {
  cards: PoolCard[];
  sortKey: SortKey;
  groupMode: GroupMode;
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
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
  onCardContextMenu,
}: {
  cards: PoolCard[];
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
}) {
  const byCmc = groupByCmc(cards);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cardWidth, setCardWidth] = useState(118);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = (containerWidth: number) => {
      const columns = 8;
      const gapPx = 12; // Matches gap-3
      const bucketPadding = 16; // Matches p-2
      const bucketWidth = (containerWidth - gapPx * (columns - 1)) / columns;
      const targetCardWidth = Math.floor(bucketWidth - bucketPadding);
      setCardWidth(Math.max(88, Math.min(170, targetCardWidth)));
    };

    updateWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateWidth(entry.contentRect.width);
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const cardHeight = Math.round((cardWidth * 680) / 488);
  const peekHeight = 30;

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-3 pb-3 sm:grid-cols-4 lg:grid-cols-8">
      {[...byCmc.entries()].map(([cmc, bucket]) => {
        const ordered = sortCurveColumn(bucket);
        const stackHeight = ordered.length > 0 ? (ordered.length - 1) * peekHeight + cardHeight + 4 : cardHeight;
        return (
          <div key={cmc} className="min-w-0 space-y-2 rounded-md border border-border/60 bg-card/30 p-2">
            <div className="text-center text-sm font-semibold">
              {cmc === 7 ? '7+' : cmc} <span className="text-muted-foreground">({ordered.length})</span>
            </div>
            {ordered.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-muted-foreground">--</div>
            ) : (
              <div className="mx-auto" style={{ width: cardWidth }}>
                <div className="relative" style={{ height: stackHeight }}>
                  {ordered.map((card, index) => {
                    const image = getImageUrl(card, 'normal') ?? getImageUrl(card, 'border_crop');
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
                        imageUrl={image}
                        element="div"
                      >
                        <div
                          className={`absolute left-0 right-0 overflow-hidden ${stackSliceClass}`}
                          style={{ top: index * peekHeight, height: visibleHeight }}
                          onContextMenu={onCardContextMenu ? (event) => onCardContextMenu(event, card) : undefined}
                        >
                          {image ? (
                            <img
                              src={image}
                              alt={card.name}
                              loading="lazy"
                              decoding="async"
                              className={`h-full w-full bg-black object-contain object-top shadow-sm ${
                                isTop ? 'rounded-md' : 'rounded-t-md rounded-b-none'
                              }`}
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
                          {card.quantity > 1 ? (
                            <span className="absolute right-1 top-1 rounded-full border border-white/35 bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              x{card.quantity}
                            </span>
                          ) : null}
                        </div>
                      </HoverTarget>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrganizedCurveSections({
  cards,
  organizeBy,
  onCardContextMenu,
}: {
  cards: PoolCard[];
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
}) {
  if (organizeBy === 'cmc') {
    return <CurveColumns cards={cards} onCardContextMenu={onCardContextMenu} />;
  }

  const groups = groupByOrganize(cards, organizeBy);
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([label, groupedCards]) => (
        <div key={label} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            <GroupHeadingLabel label={label} />
          </h3>
          <CurveColumns cards={groupedCards} onCardContextMenu={onCardContextMenu} />
        </div>
      ))}
    </div>
  );
}

export function CurveView({ cards, sortKey, groupMode, organizeBy, onCardContextMenu }: CurveViewProps) {
  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards added yet.</p>;
  }

  const sortedCards = sortCards(cards, sortKey);

  if (groupMode === 'flat') {
    return <OrganizedCurveSections cards={sortedCards} organizeBy={organizeBy} onCardContextMenu={onCardContextMenu} />;
  }

  const byPhase = groupByPhase(sortedCards);
  return (
    <div className="space-y-6">
      {[...byPhase.entries()].map(([phase, phaseCards]) => (
        <div key={phase} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phase}</h3>
          <OrganizedCurveSections cards={phaseCards} organizeBy={organizeBy} onCardContextMenu={onCardContextMenu} />
        </div>
      ))}
    </div>
  );
}
