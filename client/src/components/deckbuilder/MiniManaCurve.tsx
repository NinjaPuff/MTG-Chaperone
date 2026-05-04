type CurveCard = {
  cmc: number;
  quantity: number;
};

type MiniManaCurveProps = {
  cards: CurveCard[];
  className?: string;
};

function buildBuckets(cards: CurveCard[]) {
  const buckets = Array.from({ length: 8 }, () => 0);
  for (const card of cards) {
    const quantity = Math.max(0, Math.floor(card.quantity));
    const bucket = Math.max(0, Math.min(7, Math.floor(card.cmc)));
    buckets[bucket] += quantity;
  }
  return buckets;
}

export function MiniManaCurve({ cards, className }: MiniManaCurveProps) {
  const buckets = buildBuckets(cards);
  const maxValue = Math.max(1, ...buckets);

  return (
    <div className={className}>
      <div className="flex h-20 items-end gap-1 rounded-md border border-border/70 bg-background p-2">
        {buckets.map((count, index) => {
          const height = Math.max(8, Math.round((count / maxValue) * 100));
          return (
            <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-primary/70"
                style={{ height: `${count > 0 ? height : 8}%` }}
                title={`${index === 7 ? '7+' : index}: ${count}`}
              />
              <span className="text-[10px] text-muted-foreground">{index === 7 ? '7+' : index}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

