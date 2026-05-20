import { SetSymbolGroup } from '@/components/SetSymbolGroup';
import type { ScryfallSetSummary } from '@/hooks/useScryfallSets';

type PlayerPoolSetSymbolsProps = {
  userId: string;
  poolSetsByUserId: Map<string, string[]>;
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

  const setCodes = poolSetsByUserId.get(userId);
  if (!setCodes?.length) {
    return null;
  }

  return <SetSymbolGroup setCodes={setCodes} primaryOnly={primaryOnly} getSet={getSet} />;
}
