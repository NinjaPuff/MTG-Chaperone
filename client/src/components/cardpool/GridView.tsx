import { useVirtualizer } from '@tanstack/react-virtual';
import type { MouseEvent, ReactNode, RefObject } from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from './types';
import { HoverTarget, type TouchAction } from './CardPreviewContext';
import { GroupHeadingLabel } from './GroupHeadingLabel';
import { PoolCardImage } from './PoolCardImage';
import { getPrimaryCardImageUrl } from '@/lib/cardImage';
import {
  cardImageAspectClassName,
  cardImageFallbackClassName,
  cardImageLandscapeFrameClassName,
  cardImageLandscapeRotationClassName,
  cardThumbnailLayoutToken,
  faceTypeLineFromCard,
  needsImageRotation,
} from '@/lib/cardLayout';
import {
  GRID_GAP_PX,
  buildVirtualGridRows,
  computeGridCellWidth,
  computeGridColumnCount,
  computeWindowScrollMargin,
  estimateVirtualGridRowHeight,
} from '@/lib/virtualGridRows';

type GridViewProps = {
  cards: PoolCard[];
  sortKey: SortKey;
  groupMode: GroupMode;
  organizeBy: StacksOrganizeBy;
  cardWidth: number;
  scrollElementRef?: RefObject<HTMLElement | null>;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
};

function CardCell({
  card,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: {
  card: PoolCard;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
}) {
  const image = getPrimaryCardImageUrl(card.imageUris, ['border_crop', 'normal', 'small']);
  const thumbnailLayout = cardThumbnailLayoutToken(card.layout, card.typeLine);
  const rotateLandscape = needsImageRotation(
    card.layout,
    faceTypeLineFromCard(card.typeLine, 0),
  );

  return (
    <HoverTarget
      scryfallId={card.scryfallId}
      name={card.name}
      layout={card.layout}
      typeLine={card.typeLine}
      imageUrl={image}
      touchActions={getTouchActions?.(card)}
      element="div"
    >
      <div
        className={`relative${onCardClick ? ' cursor-pointer' : ''}`}
        onContextMenu={onCardContextMenu ? (event) => onCardContextMenu(event, card) : undefined}
        onClick={onCardClick ? () => onCardClick(card) : undefined}
        onDoubleClick={onCardDoubleClick ? () => onCardDoubleClick(card) : undefined}
      >
        {rotateLandscape ? (
          <div className={cardImageLandscapeFrameClassName()}>
            <PoolCardImage
              name={card.name}
              scryfallId={card.scryfallId}
              imageUris={card.imageUris}
              preference={['border_crop', 'normal', 'small']}
              className={cardImageLandscapeRotationClassName()}
              fallbackClassName="inline-flex h-full w-full items-center justify-center bg-muted p-2 text-center text-xs text-muted-foreground"
            />
          </div>
        ) : (
          <PoolCardImage
            name={card.name}
            scryfallId={card.scryfallId}
            imageUris={card.imageUris}
            preference={['border_crop', 'normal', 'small']}
            className={cardImageAspectClassName(thumbnailLayout)}
            fallbackClassName={cardImageFallbackClassName(thumbnailLayout)}
          />
        )}
        {card.quantity > 1 ? (
          <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
            x{card.quantity}
          </span>
        ) : null}
        {renderBadge ? (
          <div className="absolute left-1 top-1 z-10" data-testid="pool-card-badge-anchor">
            {renderBadge(card)}
          </div>
        ) : null}
      </div>
    </HoverTarget>
  );
}

function VirtualGridRowContent({
  row,
  columnCount,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: {
  row: ReturnType<typeof buildVirtualGridRows>[number];
  columnCount: number;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
}) {
  if (row.kind === 'phase-header') {
    return (
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</h3>
    );
  }

  if (row.kind === 'section-header') {
    return (
      <h4 className="text-sm font-semibold text-muted-foreground">
        <GroupHeadingLabel label={row.label} /> ({row.count})
      </h4>
    );
  }

  return (
    <div
      className="grid gap-2"
      data-testid="virtual-grid-card-row"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {row.cards.map((card) => (
        <CardCell
          key={`${card.phaseLabel}-${card.scryfallId}`}
          card={card}
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

export function GridView({
  cards,
  sortKey,
  groupMode,
  organizeBy,
  cardWidth,
  scrollElementRef,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: GridViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const element = parentRef.current;
    if (!element) {
      return;
    }

    const updateLayout = (width: number) => {
      setContainerWidth(Math.max(0, Math.round(width)));
      const scrollParent = scrollElementRef?.current ?? null;
      if (scrollParent) {
        const listTop = element.getBoundingClientRect().top;
        const parentTop = scrollParent.getBoundingClientRect().top;
        setScrollMargin(listTop - parentTop + scrollParent.scrollTop);
        return;
      }
      setScrollMargin(computeWindowScrollMargin(element, window.scrollY));
    };

    updateLayout(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateLayout(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [cards.length, cardWidth, groupMode, organizeBy, sortKey, scrollElementRef]);

  const columnCount = useMemo(
    () => computeGridColumnCount(containerWidth, cardWidth, GRID_GAP_PX),
    [containerWidth, cardWidth],
  );

  const cellWidth = useMemo(
    () => computeGridCellWidth(containerWidth, columnCount, GRID_GAP_PX),
    [containerWidth, columnCount],
  );

  const rows = useMemo(
    () =>
      buildVirtualGridRows(cards, {
        sortKey,
        groupMode,
        organizeBy,
        columnCount,
      }),
    [cards, sortKey, groupMode, organizeBy, columnCount],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElementRef?.current ?? document.documentElement,
    estimateSize: (index) => estimateVirtualGridRowHeight(rows[index], cellWidth, GRID_GAP_PX),
    overscan: 3,
    scrollMargin,
    measureElement:
      typeof window !== 'undefined' && window.ResizeObserver
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards added yet.</p>;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const rowContentProps = {
    columnCount,
    onCardContextMenu,
    onCardClick,
    onCardDoubleClick,
    renderBadge,
    getTouchActions,
  };

  if (virtualItems.length === 0) {
    return (
      <div ref={parentRef} className="relative w-full" data-testid="virtual-grid-container">
        {rows.map((row) => (
          <div key={row.id} data-testid="virtual-grid-row">
            <VirtualGridRowContent row={row} {...rowContentProps} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="relative w-full" data-testid="virtual-grid-container">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) {
            return null;
          }

          return (
            <div
              key={row.id}
              data-index={virtualRow.index}
              data-testid="virtual-grid-row"
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <VirtualGridRowContent
                row={row}
                {...rowContentProps}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
