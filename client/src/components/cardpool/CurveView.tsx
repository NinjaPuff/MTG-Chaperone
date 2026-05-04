import type { MouseEvent } from 'react';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from './types';
import { GroupHeadingLabel } from './GroupHeadingLabel';
import { getPrimaryType, groupByCmc, groupByOrganize, groupByPhase, sortCards } from '@/lib/cardPoolSort';

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

  return (
    <div className="grid grid-cols-8 gap-2 pb-3">
      {[...byCmc.entries()].map(([cmc, bucket]) => {
        const ordered = sortCurveColumn(bucket);
        return (
          <div key={cmc} className="min-w-0 space-y-1 rounded-md border border-border/60 bg-card/30 p-2">
            <div className="text-center text-sm font-semibold">
              {cmc === 7 ? '7+' : cmc} <span className="text-muted-foreground">({ordered.length})</span>
            </div>
            {ordered.length === 0 ? (
              <div className="py-2 text-center text-[11px] text-muted-foreground">--</div>
            ) : (
              <div className="space-y-1">
                {ordered.map((card) => (
                  <div
                    key={`${card.phaseLabel}-${card.scryfallId}`}
                    className="rounded border border-border/60 px-1.5 py-1 text-[11px]"
                    onContextMenu={onCardContextMenu ? (event) => onCardContextMenu(event, card) : undefined}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-semibold text-muted-foreground">
                        {card.quantity}x
                      </span>
                      <span className="min-w-0 truncate">{card.name}</span>
                    </div>
                  </div>
                ))}
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
