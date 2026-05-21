import { Fragment, type MouseEvent, type ReactNode } from 'react';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from './types';
import { HoverTarget, type TouchAction } from './CardPreviewContext';
import { GroupHeadingLabel } from './GroupHeadingLabel';
import { ManaCostSymbols } from './ManaCostSymbols';
import { SetSymbol } from '@/components/SetSymbol';
import { useScryfallSets } from '@/hooks/useScryfallSets';
import { getImageUrl, groupByOrganize, groupByPhase, sortCards } from '@/lib/cardPoolSort';

type ListViewProps = {
  cards: PoolCard[];
  sortKey: SortKey;
  groupMode: GroupMode;
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
};

type OrganizeSectionProps = {
  cards: PoolCard[];
  sortKey: SortKey;
  organizeBy: StacksOrganizeBy;
  onCardContextMenu?: (event: MouseEvent, card: PoolCard) => void;
  onCardClick?: (card: PoolCard) => void;
  onCardDoubleClick?: (card: PoolCard) => void;
  renderBadge?: (card: PoolCard) => ReactNode;
  getTouchActions?: (card: PoolCard) => TouchAction[];
};

function OrganizeSections({
  cards,
  sortKey,
  organizeBy,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: OrganizeSectionProps) {
  const { getSet } = useScryfallSets();
  const groups = groupByOrganize(cards, organizeBy);

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([label, groupedCards]) => {
        const sorted = sortCards(groupedCards, sortKey);
        return (
          <div key={label} className="space-y-1">
            <h4 className="text-sm font-semibold text-muted-foreground">
              <GroupHeadingLabel label={label} /> ({groupedCards.reduce((sum, card) => sum + card.quantity, 0)})
            </h4>
            <div className="space-y-1 rounded-md border border-border p-2">
              {sorted.map((card) => (
                <div
                  key={`${card.phaseLabel}-${card.scryfallId}`}
                  className={`flex items-center gap-2 py-0.5 text-sm${onCardClick ? ' cursor-pointer' : ''}`}
                  onContextMenu={onCardContextMenu ? (event) => onCardContextMenu(event, card) : undefined}
                  onClick={onCardClick ? () => onCardClick(card) : undefined}
                  onDoubleClick={onCardDoubleClick ? () => onCardDoubleClick(card) : undefined}
                >
                  <span className="w-8 text-right font-mono text-muted-foreground">{card.quantity}x</span>
                  <HoverTarget
                    scryfallId={card.scryfallId}
                    name={card.name}
                    imageUrl={getImageUrl(card, 'normal')}
                    touchActions={getTouchActions?.(card)}
                  >
                    <span className="cursor-default truncate">{card.name}</span>
                  </HoverTarget>
                  <ManaCostSymbols
                    manaCost={card.manaCost}
                    fallbackCmc={card.cmc}
                    fallbackColors={card.colorIdentity}
                    className="ml-auto whitespace-nowrap"
                  />
                  {renderBadge ? <span className="ml-1 shrink-0">{renderBadge(card)}</span> : null}
                  <SetSymbol
                    setCode={card.setCode}
                    size="sm"
                    iconUri={getSet(card.setCode)?.icon_svg_uri}
                    setName={getSet(card.setCode)?.name}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ListView({
  cards,
  sortKey,
  groupMode,
  organizeBy,
  onCardContextMenu,
  onCardClick,
  onCardDoubleClick,
  renderBadge,
  getTouchActions,
}: ListViewProps) {
  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards added yet.</p>;
  }

  if (groupMode === 'flat') {
    return (
      <OrganizeSections
        cards={cards}
        sortKey={sortKey}
        organizeBy={organizeBy}
        onCardContextMenu={onCardContextMenu}
        onCardClick={onCardClick}
        onCardDoubleClick={onCardDoubleClick}
        renderBadge={renderBadge}
        getTouchActions={getTouchActions}
      />
    );
  }

  const phaseGroups = groupByPhase(cards);

  return (
    <div className="space-y-5">
      {[...phaseGroups.entries()].map(([phase, phaseCards]) => (
        <Fragment key={phase}>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phase}</h3>
            <OrganizeSections
              cards={phaseCards}
              sortKey={sortKey}
              organizeBy={organizeBy}
              onCardContextMenu={onCardContextMenu}
              onCardClick={onCardClick}
              onCardDoubleClick={onCardDoubleClick}
              renderBadge={renderBadge}
              getTouchActions={getTouchActions}
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
