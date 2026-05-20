import { useMemo } from 'react';
import { SetSymbol, type SetSymbolSize } from '@/components/SetSymbol';
import { normalizeSetCode } from '@/lib/setSymbol';
import { cn } from '@/lib/utils';

type ScryfallSetLookup = (code: string) => { name: string; icon_svg_uri: string | null } | undefined;

type SetSymbolGroupProps = {
  setCodes: string[];
  primaryOnly?: boolean;
  maxVisible?: number;
  size?: SetSymbolSize;
  getSet?: ScryfallSetLookup;
  className?: string;
};

export function SetSymbolGroup({
  setCodes,
  primaryOnly = false,
  maxVisible = 3,
  size = 'sm',
  getSet,
  className,
}: SetSymbolGroupProps) {
  const normalizedCodes = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const code of setCodes) {
      const normalized = normalizeSetCode(code);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }, [setCodes]);

  if (normalizedCodes.length === 0) {
    return null;
  }

  const visibleCodes = primaryOnly ? normalizedCodes.slice(0, 1) : normalizedCodes.slice(0, maxVisible);
  const overflowCount = primaryOnly ? 0 : Math.max(0, normalizedCodes.length - maxVisible);

  return (
    <span
      data-testid="set-symbol-group"
      className={cn('inline-flex items-center gap-1', className)}
    >
      {visibleCodes.map((code) => {
        const catalog = getSet?.(code);
        return (
          <SetSymbol
            key={code}
            setCode={code}
            size={size}
            iconUri={catalog?.icon_svg_uri}
            setName={catalog?.name}
          />
        );
      })}
      {overflowCount > 0 ? (
        <span className="text-[10px] font-medium text-muted-foreground">+{overflowCount}</span>
      ) : null}
    </span>
  );
}
