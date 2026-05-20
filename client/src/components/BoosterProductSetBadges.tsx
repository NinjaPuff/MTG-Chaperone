import { useMemo } from 'react';
import { resolvePrimarySetCode } from '@mtg-league/shared';
import { SetSymbol } from '@/components/SetSymbol';
import type { ScryfallSetSummary } from '@/hooks/useScryfallSets';
import { cn } from '@/lib/utils';

export type BoosterProductBadgeProduct = {
  id: string;
  primarySetCode?: string | null;
  setCodes: Array<{ id: string; setCode: string }>;
};

type BoosterProductSetBadgesProps = {
  product: BoosterProductBadgeProduct;
  getSet: (code: string) => ScryfallSetSummary | undefined;
};

export function BoosterProductSetBadges({ product, getSet }: BoosterProductSetBadgesProps) {
  const primaryCode = resolvePrimarySetCode(
    product.setCodes.map((entry) => entry.setCode),
    product.primarySetCode,
  );

  const orderedSetCodes = useMemo(() => {
    if (!primaryCode) {
      return product.setCodes;
    }

    return [...product.setCodes].sort((a, b) => {
      if (a.setCode === primaryCode) {
        return -1;
      }
      if (b.setCode === primaryCode) {
        return 1;
      }
      return a.setCode.localeCompare(b.setCode);
    });
  }, [product.setCodes, primaryCode]);

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {orderedSetCodes.map((entry) => {
        const isPrimary = entry.setCode === primaryCode;

        return (
          <span
            key={entry.id}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs',
              isPrimary
                ? 'border border-primary bg-primary/10 text-primary'
                : 'bg-accent text-accent-foreground',
            )}
            aria-label={isPrimary ? `${entry.setCode} primary set` : entry.setCode}
          >
            <SetSymbol
              setCode={entry.setCode}
              iconUri={getSet(entry.setCode)?.icon_svg_uri}
              setName={getSet(entry.setCode)?.name}
            />
            {entry.setCode}
          </span>
        );
      })}
    </div>
  );
}
