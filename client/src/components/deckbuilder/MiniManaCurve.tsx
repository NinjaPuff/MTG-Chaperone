import { getPrimaryType } from '@/lib/cardPoolSort';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type CurveCard = {
  cmc: number;
  quantity: number;
  typeLine?: string;
};

export type SplitBucket = {
  creatures: number;
  nonCreatures: number;
  total: number;
};

const MIN_FILL_PERCENT = 8;

export function isCurveCardCreature(typeLine: string | undefined): boolean {
  if (!typeLine) {
    return false;
  }
  return getPrimaryType(typeLine) === 'Creature';
}

export function buildSplitBuckets(cards: CurveCard[]): SplitBucket[] {
  const buckets: SplitBucket[] = Array.from({ length: 8 }, () => ({
    creatures: 0,
    nonCreatures: 0,
    total: 0,
  }));

  for (const card of cards) {
    const quantity = Math.max(0, Math.floor(card.quantity));
    if (quantity === 0) {
      continue;
    }
    const bucket = Math.max(0, Math.min(7, Math.floor(card.cmc)));
    if (isCurveCardCreature(card.typeLine)) {
      buckets[bucket].creatures += quantity;
    } else {
      buckets[bucket].nonCreatures += quantity;
    }
    buckets[bucket].total += quantity;
  }

  return buckets;
}

export function buildBuckets(cards: CurveCard[]): number[] {
  return buildSplitBuckets(cards).map((bucket) => bucket.total);
}

export function barFillPercent(count: number, maxValue: number): number {
  if (count <= 0) {
    return 0;
  }
  return Math.max(MIN_FILL_PERCENT, Math.round((count / maxValue) * 100));
}

export function bucketAxisLabel(index: number): string {
  return index === 7 ? '7+' : String(index);
}

export function bucketTooltipLabel(index: number, bucket: SplitBucket): string {
  const label = bucketAxisLabel(index);
  if (bucket.total === 0) {
    return `${label}: 0`;
  }
  return `${label}: ${bucket.total} total (${bucket.creatures} creatures, ${bucket.nonCreatures} non-creatures)`;
}

type ManaCurveBucketTooltipContentProps = {
  index: number;
  bucket: SplitBucket;
};

export function ManaCurveBucketTooltipContent({ index, bucket }: ManaCurveBucketTooltipContentProps) {
  const label = bucketAxisLabel(index);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">CMC {label}</p>
        <p className="text-xs text-muted-foreground">
          {bucket.total} card{bucket.total === 1 ? '' : 's'} total
        </p>
      </div>
      {bucket.total > 0 ? (
        <ul className="space-y-1 text-xs">
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/70" aria-hidden />
            <span>
              {bucket.creatures} creature{bucket.creatures === 1 ? '' : 's'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted-foreground/70" aria-hidden />
            <span>
              {bucket.nonCreatures} non-creature{bucket.nonCreatures === 1 ? '' : 's'}
            </span>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

type MiniManaCurveProps = {
  cards: CurveCard[];
  className?: string;
};

export function MiniManaCurve({ cards, className }: MiniManaCurveProps) {
  const buckets = buildSplitBuckets(cards);
  const maxValue = Math.max(1, ...buckets.map((bucket) => bucket.total));

  return (
    <TooltipProvider delayDuration={150}>
      <div className={className}>
        <div className="grid h-20 grid-rows-[minmax(0,1fr)_auto] gap-0.5 overflow-hidden rounded-md border border-border/70 bg-background p-2">
          <div className="flex min-h-0 items-end gap-1 overflow-hidden">
            {buckets.map((bucket, index) => {
              const fillPct = barFillPercent(bucket.total, maxValue);
              return (
                <div
                  key={index}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end overflow-hidden"
                >
                  {fillPct > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full shrink-0 cursor-default flex-col overflow-hidden rounded-sm border-0 bg-transparent p-0"
                          style={{ height: `${fillPct}%` }}
                          aria-label={bucketTooltipLabel(index, bucket)}
                        >
                          {bucket.nonCreatures > 0 ? (
                            <div
                              className="w-full bg-muted-foreground/70"
                              style={{ flexGrow: bucket.nonCreatures, flexBasis: 0, minHeight: 1 }}
                            />
                          ) : null}
                          {bucket.creatures > 0 ? (
                            <div
                              className="w-full bg-primary/70"
                              style={{ flexGrow: bucket.creatures, flexBasis: 0, minHeight: 1 }}
                            />
                          ) : null}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <ManaCurveBucketTooltipContent index={index} bucket={bucket} />
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1">
            {buckets.map((_, index) => (
              <span
                key={index}
                className="min-w-0 flex-1 text-center text-[10px] leading-none text-muted-foreground"
              >
                {index === 7 ? '7+' : index}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-1 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary/70" aria-hidden />
            Creatures
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/70" aria-hidden />
            Non-creatures
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
