import type { MouseEvent } from 'react';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from './types';
import { HoverTarget } from './CardPreviewContext';
import { GroupHeadingLabel } from './GroupHeadingLabel';
import { getImageUrl, groupByOrganize, groupByPhase, sortCards } from '@/lib/cardPoolSort';

type GridViewProps = {
  cards: PoolCard[];
  sortKey: SortKey;
  groupMode: GroupMode;
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
};

function CardCell({ card, onCardContextMenu }: { card: PoolCard; onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void }) {
  const image = getImageUrl(card, 'border_crop') ?? getImageUrl(card, 'normal');

  return (
    <HoverTarget scryfallId={card.scryfallId} name={card.name} imageUrl={image} element="div">
      <div className="relative" onContextMenu={onCardContextMenu ? (event) => onCardContextMenu(event, card) : undefined}>
        {image ? (
          <img
            src={image}
            alt={card.name}
            loading="lazy"
            decoding="async"
            className="aspect-[488/680] w-full rounded-md border border-border object-cover"
          />
        ) : (
          <div className="aspect-[488/680] w-full rounded-md border border-border bg-muted p-2 text-center text-xs text-muted-foreground">
            {card.name}
          </div>
        )}
        {card.quantity > 1 ? (
          <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
            x{card.quantity}
          </span>
        ) : null}
      </div>
    </HoverTarget>
  );
}

function OrganizedGridSections({
  cards,
  sortKey,
  organizeBy,
  onCardContextMenu,
}: {
  cards: PoolCard[];
  sortKey: SortKey;
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
}) {
  const groups = groupByOrganize(cards, organizeBy);

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([label, groupedCards]) => (
        <div key={label} className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">
            <GroupHeadingLabel label={label} /> ({groupedCards.reduce((sum, card) => sum + card.quantity, 0)})
          </h4>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {sortCards(groupedCards, sortKey).map((card) => (
              <CardCell key={`${card.phaseLabel}-${card.scryfallId}`} card={card} onCardContextMenu={onCardContextMenu} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GridView({ cards, sortKey, groupMode, organizeBy, onCardContextMenu }: GridViewProps) {
  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards added yet.</p>;
  }

  if (groupMode === 'flat') {
    return (
      <OrganizedGridSections
        cards={cards}
        sortKey={sortKey}
        organizeBy={organizeBy}
        onCardContextMenu={onCardContextMenu}
      />
    );
  }

  const byPhase = groupByPhase(cards);

  return (
    <div className="space-y-5">
      {[...byPhase.entries()].map(([phase, phaseCards]) => (
        <div key={phase} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phase}</h3>
          <OrganizedGridSections
            cards={phaseCards}
            sortKey={sortKey}
            organizeBy={organizeBy}
            onCardContextMenu={onCardContextMenu}
          />
        </div>
      ))}
    </div>
  );
}
