import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeSetCode, resolveSetSymbolSources, type SetSymbolSource } from '@/lib/setSymbol';

export type SetSymbolSize = 'sm' | 'md';

type SetSymbolProps = {
  setCode: string;
  size?: SetSymbolSize;
  iconUri?: string | null;
  setName?: string;
  className?: string;
};

const sizeClasses: Record<SetSymbolSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

function nextRenderableSource(sources: SetSymbolSource[], failedIndex: number): SetSymbolSource | null {
  for (let i = failedIndex + 1; i < sources.length; i++) {
    const source = sources[i];
    if (source.type === 'text') {
      return source;
    }
    if (source.url) {
      return source;
    }
  }
  return null;
}

export function SetSymbol({ setCode, size = 'sm', iconUri, setName, className }: SetSymbolProps) {
  const normalizedCode = normalizeSetCode(setCode);
  const sources = useMemo(() => resolveSetSymbolSources(normalizedCode, iconUri), [normalizedCode, iconUri]);
  const [failedIndex, setFailedIndex] = useState(-1);

  useEffect(() => {
    setFailedIndex(-1);
  }, [normalizedCode, iconUri]);

  if (!normalizedCode) {
    return null;
  }

  const label = setName ? `${setName} (${normalizedCode})` : normalizedCode;
  const activeSource = failedIndex < 0 ? sources[0] : nextRenderableSource(sources, failedIndex);

  const handleFail = (index: number) => {
    setFailedIndex((current) => (index > current ? index : current));
  };

  if (!activeSource || activeSource.type === 'text') {
    return (
      <span
        data-testid={`set-symbol-${normalizedCode}`}
        className={cn(
          'inline-flex items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold uppercase text-muted-foreground',
          className,
        )}
        aria-label={label}
        title={label}
      >
        {normalizedCode}
      </span>
    );
  }

  const sourceIndex = sources.indexOf(activeSource);
  const dimension = sizeClasses[size];

  if (activeSource.type === 'img') {
    return (
      <span
        data-testid={`set-symbol-${normalizedCode}`}
        className={cn('inline-flex shrink-0 items-center justify-center', dimension, className)}
        title={label}
      >
        <img
          data-testid="set-symbol-img"
          src={activeSource.url}
          alt=""
          className={cn('h-full w-full object-contain dark:invert', dimension)}
          onError={() => handleFail(sourceIndex)}
        />
      </span>
    );
  }

  return (
    <span
      data-testid={`set-symbol-${normalizedCode}`}
      className={cn('inline-flex shrink-0 items-center justify-center', dimension, className)}
      title={label}
    >
      <img
        data-testid="set-symbol-mask"
        src={activeSource.url}
        alt=""
        className="hidden"
        onError={() => handleFail(sourceIndex)}
      />
      <span
        className={cn('inline-block bg-current', dimension)}
        style={{
          maskImage: `url(${activeSource.url})`,
          WebkitMaskImage: `url(${activeSource.url})`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
        role="img"
        aria-label={label}
      />
    </span>
  );
}
