import { SetSymbol } from '@/components/SetSymbol';
import type { ScryfallSetSummary } from '@/hooks/useScryfallSets';
import { cn } from '@/lib/utils';

export type SetCacheStat = {
  setCode: string;
  cachedCount: number;
  lastFetched: string | null;
};

type BoosterProductCacheControlsProps = {
  product: {
    id: string;
    setCodes: Array<{ id: string; setCode: string }>;
  };
  cacheStats: Record<string, SetCacheStat>;
  importingSetCode: string | null;
  importingProductId: string | null;
  onImportSet: (setCode: string) => void;
  onImportProduct: (productId: string) => void;
  getSet?: (code: string) => ScryfallSetSummary | undefined;
};

function formatLastFetched(lastFetched: string | null) {
  if (!lastFetched) {
    return null;
  }

  const date = new Date(lastFetched);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

export function BoosterProductCacheControls({
  product,
  cacheStats,
  importingSetCode,
  importingProductId,
  onImportSet,
  onImportProduct,
  getSet = () => undefined,
}: BoosterProductCacheControlsProps) {
  const isProductImporting = importingProductId === product.id;

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onImportProduct(product.id)}
          disabled={isProductImporting}
        >
          {isProductImporting ? 'Importing all sets…' : 'Import all sets to cache'}
        </button>
        <p className="text-xs text-muted-foreground">
          Imports each configured set from Scryfall. May take a minute for large sets.
        </p>
      </div>

      <ul className="space-y-2">
        {product.setCodes.map((entry) => {
          const stat = cacheStats[entry.setCode];
          const isSetImporting = importingSetCode === entry.setCode;

          return (
            <li
              key={entry.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm',
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="inline-flex items-center gap-1 font-medium">
                  <SetSymbol
                    setCode={entry.setCode}
                    iconUri={getSet(entry.setCode)?.icon_svg_uri}
                    setName={getSet(entry.setCode)?.name}
                  />
                  {entry.setCode}
                </span>
                <span className="text-muted-foreground">
                  {stat && stat.cachedCount > 0
                    ? `${stat.cachedCount} cards`
                    : 'Not imported'}
                  {stat?.lastFetched ? ` · Updated ${formatLastFetched(stat.lastFetched)}` : null}
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onImportSet(entry.setCode)}
                disabled={isSetImporting || isProductImporting}
              >
                {isSetImporting ? `Re-importing ${entry.setCode}…` : `Re-import ${entry.setCode}`}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
