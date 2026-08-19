import { useMemo, useState } from 'react';
import { CurveView } from '@/components/cardpool/CurveView';
import { StacksView } from '@/components/cardpool/StacksView';
import type { PoolCard } from '@/components/cardpool/types';
import { useCardImageWidth } from '@/hooks/useCardImageWidth';
import { getPrimaryType } from '@/lib/cardPoolSort';
import type { BuilderDeck, DeckBuilderCard } from './types';
import { MiniManaCurve } from './MiniManaCurve';
import type { MouseEvent } from 'react';

type DeckAnalyticsViewProps = {
  deck: BuilderDeck;
  poolImageByCardId?: Map<string, string>;
  editable?: boolean;
  onCardClick?: (card: DeckBuilderCard, deckId: string) => void;
  onCardContextMenu?: (event: MouseEvent, card: DeckBuilderCard, deckId: string) => void;
};

function toPoolCards(deck: BuilderDeck, poolImageByCardId?: Map<string, string>): PoolCard[] {
  return deck.cards.map((card) => {
    const imageUrl = poolImageByCardId?.get(card.cachedCardId) ?? null;
    return {
    scryfallId: card.cachedCardId,
    name: card.name,
    layout: card.layout,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    rarity: 'unknown',
    setCode: 'UNK',
    imageUris: imageUrl ? { normal: imageUrl, border_crop: imageUrl } : null,
    cmc: card.cmc,
    colors: card.colorIdentity,
    colorIdentity: card.colorIdentity,
    quantity: card.quantity,
    phaseLabel: card.zone === 'main' ? 'Main Deck' : 'Sideboard',
    phaseQuantities: {
      [card.zone === 'main' ? 'Main Deck' : 'Sideboard']: card.quantity,
    },
  };
  });
}

export function DeckAnalyticsView({ deck, poolImageByCardId, editable = false, onCardClick, onCardContextMenu }: DeckAnalyticsViewProps) {
  const [viewMode, setViewMode] = useState<'curve' | 'stacks'>('curve');
  const [splitCreatureRows, setSplitCreatureRows] = useState(true);
  const { cardImageWidth } = useCardImageWidth();
  const cards = useMemo(() => toPoolCards(deck, poolImageByCardId), [deck, poolImageByCardId]);
  const mainCards = cards.filter((card) => card.phaseLabel === 'Main Deck');

  const mainDeckCount = mainCards.reduce((sum, card) => sum + card.quantity, 0);
  const landCount = mainCards
    .filter((card) => /\bLand\b/i.test(card.typeLine))
    .reduce((sum, card) => sum + card.quantity, 0);
  const nonLandCount = Math.max(0, mainDeckCount - landCount);

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of mainCards) {
      const type = getPrimaryType(card.typeLine);
      map.set(type, (map.get(type) ?? 0) + card.quantity);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [mainCards]);

  const pipBreakdown = useMemo(() => {
    const map = new Map<string, number>([
      ['W', 0],
      ['U', 0],
      ['B', 0],
      ['R', 0],
      ['G', 0],
    ]);
    const regex = /\{([WUBRG])\}/g;
    for (const card of mainCards) {
      if (!card.manaCost) {
        continue;
      }
      let match: RegExpExecArray | null;
      while ((match = regex.exec(card.manaCost)) !== null) {
        const symbol = match[1];
        map.set(symbol, (map.get(symbol) ?? 0) + card.quantity);
      }
    }
    return [...map.entries()];
  }, [mainCards]);

  const curveCards = useMemo(
    () => mainCards.map((card) => ({ cmc: card.cmc, quantity: card.quantity, typeLine: card.typeLine })),
    [mainCards],
  );

  const findDeckCard = (card: PoolCard): DeckBuilderCard | null => {
    const zone = card.phaseLabel === 'Main Deck' ? 'main' : 'sideboard';
    return deck.cards.find((entry) => entry.cachedCardId === card.scryfallId && entry.zone === zone) ?? null;
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-muted/20 p-4 ring-1 ring-primary/10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Main Deck</p>
          <p className="text-xl font-semibold">{mainDeckCount}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Lands</p>
          <p className="text-xl font-semibold">{landCount}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Non-Lands</p>
          <p className="text-xl font-semibold">{nonLandCount}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Sideboard</p>
          <p className="text-xl font-semibold">
            {cards.filter((card) => card.phaseLabel === 'Sideboard').reduce((sum, card) => sum + card.quantity, 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type Breakdown</p>
          <div className="space-y-1 text-sm">
            {typeBreakdown.map(([type, qty]) => (
              <div key={type} className="flex items-center justify-between">
                <span>{type}</span>
                <span className="text-muted-foreground">{qty}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mana Pips</p>
          <div className="space-y-1 text-sm">
            {pipBreakdown.map(([pip, qty]) => (
              <div key={pip} className="flex items-center justify-between">
                <span>{pip}</span>
                <span className="text-muted-foreground">{qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs ${viewMode === 'curve' ? 'border-primary bg-primary/10' : 'border-border'}`}
          onClick={() => setViewMode('curve')}
        >
          Curve
        </button>
        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs ${viewMode === 'stacks' ? 'border-primary bg-primary/10' : 'border-border'}`}
          onClick={() => setViewMode('stacks')}
        >
          Stacks
        </button>
        {viewMode === 'curve' ? (
          <label className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              data-testid="deck-analytics-combined-curve"
              checked={!splitCreatureRows}
              onChange={(event) => setSplitCreatureRows(!event.target.checked)}
            />
            Combined curve
          </label>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="deck-analytics-build-hint">
        Add cards in Build.
      </p>

      {viewMode === 'curve' ? (
        <>
          <CurveView
            cards={cards}
            sortKey="cmc"
            groupMode="phase"
            organizeBy={splitCreatureRows ? 'creature_split' : 'cmc'}
            cardWidth={cardImageWidth}
            onCardClick={
              editable && onCardClick
                ? (card) => {
                    const deckCard = findDeckCard(card);
                    if (deckCard) {
                      onCardClick(deckCard, deck.id);
                    }
                  }
                : undefined
            }
            onCardContextMenu={
              editable && onCardContextMenu
                ? (event, card) => {
                    const deckCard = findDeckCard(card);
                    if (deckCard) {
                      onCardContextMenu(event, deckCard, deck.id);
                    }
                  }
                : undefined
            }
          />
          <div className="rounded-md border border-border bg-card p-3" data-testid="deck-analytics-mini-curve">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mini Curve</p>
            <MiniManaCurve cards={curveCards} />
          </div>
        </>
      ) : (
        <>
          <StacksView
            cards={cards}
            sortKey="type"
            groupMode="phase"
            organizeBy="type"
            cardWidth={cardImageWidth}
            onCardClick={
              editable && onCardClick
                ? (card) => {
                    const deckCard = findDeckCard(card);
                    if (deckCard) {
                      onCardClick(deckCard, deck.id);
                    }
                  }
                : undefined
            }
            onCardContextMenu={
              editable && onCardContextMenu
                ? (event, card) => {
                    const deckCard = findDeckCard(card);
                    if (deckCard) {
                      onCardContextMenu(event, deckCard, deck.id);
                    }
                  }
                : undefined
            }
          />
          <div className="rounded-md border border-border bg-card p-3" data-testid="deck-analytics-mini-curve">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mini Curve</p>
            <MiniManaCurve cards={curveCards} />
          </div>
        </>
      )}
    </div>
  );
}

