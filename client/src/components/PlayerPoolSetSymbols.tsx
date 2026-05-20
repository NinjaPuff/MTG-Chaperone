import { SetSymbol } from '@/components/SetSymbol';
import type { ScryfallSetSummary } from '@/hooks/useScryfallSets';
import type { PoolSetInfo } from '@/hooks/useSeasonPoolSets';

type PlayerPoolSetSymbolsProps = {
  userId: string;
  poolSetsByUserId: Map<string, PoolSetInfo>;
  poolSetsLoading?: boolean;
  getSet?: (code: string) => ScryfallSetSummary | undefined;
  primaryOnly?: boolean;
};

export function PlayerPoolSetSymbols({
  userId,
  poolSetsByUserId,
  poolSetsLoading = false,
  getSet,
  primaryOnly = true,
}: PlayerPoolSetSymbolsProps) {
  if (poolSetsLoading) {
    return null;
  }

  const info = poolSetsByUserId.get(userId);
  if (!info?.primarySetCode) {
    return null;
  }

  if (primaryOnly) {
    const catalog = getSet?.(info.primarySetCode);
    return (
      <SetSymbol
        setCode={info.primarySetCode}
        iconUri={catalog?.icon_svg_uri}
        setName={catalog?.name}
      />
    );
  }

  return null;
}
