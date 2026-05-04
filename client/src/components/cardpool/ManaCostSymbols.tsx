import { useMemo, useState } from 'react';

const SYMBOL_BASE_URL = 'https://svgs.scryfall.io/card-symbols';

function toUpperNoSlash(token: string): string {
  return token.trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '');
}

function toLowerNoSlash(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, '').replace(/\//g, '');
}

function toUpperDash(token: string): string {
  return token.trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '-');
}

function toLowerDash(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, '').replace(/\//g, '-');
}

type ManaCostSymbolsProps = {
  manaCost: string | null;
  fallbackCmc?: number;
  fallbackColors?: string[];
  className?: string;
};

type SymbolImageProps = {
  token: string;
};

function SymbolImage({ token }: SymbolImageProps) {
  const candidates = useMemo(
    () => [toUpperNoSlash(token), toLowerNoSlash(token), toUpperDash(token), toLowerDash(token)],
    [token],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  if (candidateIndex >= candidates.length) {
    return (
      <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-sm border border-border bg-muted px-1 text-[9px] font-semibold text-muted-foreground">
        {token}
      </span>
    );
  }

  return (
    <img
      src={`${SYMBOL_BASE_URL}/${encodeURIComponent(candidates[candidateIndex])}.svg`}
      alt={token}
      className="h-3.5 w-3.5"
      loading="lazy"
      decoding="async"
      onError={() => setCandidateIndex((prev) => prev + 1)}
    />
  );
}

function NumberChip({ value }: { value: number }) {
  return (
    <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-border bg-muted px-1 text-[9px] font-semibold text-foreground">
      {value}
    </span>
  );
}

export function ManaCostSymbols({ manaCost, fallbackCmc = 0, fallbackColors = [], className }: ManaCostSymbolsProps) {
  const normalizedManaCost = manaCost ?? '';
  const tokens = [...normalizedManaCost.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).filter(Boolean);
  if (tokens.length === 0) {
    const normalizedFallbackColors = [...new Set(fallbackColors.map((value) => value.toUpperCase()))].filter((value) =>
      ['W', 'U', 'B', 'R', 'G', 'C'].includes(value),
    );
    if (fallbackCmc > 0) {
      return (
        <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`}>
          <NumberChip value={Math.floor(fallbackCmc)} />
          {normalizedFallbackColors.map((token, index) => (
            <SymbolImage key={`${token}-${index}`} token={token} />
          ))}
        </span>
      );
    }
    return <span className={className}>{normalizedManaCost || '-'}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`}>
      {tokens.map((token, index) => (
        <SymbolImage key={`${token}-${index}`} token={token} />
      ))}
    </span>
  );
}
