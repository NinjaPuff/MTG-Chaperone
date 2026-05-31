export type ParsedDecklistLine = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
};

export type DecklistLineInput = {
  quantity: number;
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
};

export type PoolExportEntry = {
  quantity: number;
  cachedCard: {
    scryfallId: string;
    name: string;
    setCode: string;
    collectorNumber?: string | null;
  };
};

const SET_CODE_PATTERN = '[A-Za-z0-9]{2,10}';
const FOIL_SUFFIX_PATTERN = /\s*(?:\*F\*|F)\s*$/i;

function stripFoilSuffix(line: string) {
  return line.replace(FOIL_SUFFIX_PATTERN, '').trim();
}

function parseQuantityAndRemainder(line: string) {
  const match = line.match(/^(\d+)\s*x?\s+(.+)$/i);
  if (!match) {
    return { quantity: 1, remainder: line.trim() };
  }

  return {
    quantity: Number(match[1]),
    remainder: match[2].trim(),
  };
}

export function parseDecklistLine(rawLine: string): ParsedDecklistLine {
  const normalized = stripFoilSuffix(rawLine.trim());
  const { quantity, remainder } = parseQuantityAndRemainder(normalized);

  const setAndNumberMatch = remainder.match(
    new RegExp(`^(.*)\\s+\\((${SET_CODE_PATTERN})\\)\\s+([^\\s]+)\\s*$`),
  );
  if (setAndNumberMatch) {
    return {
      quantity,
      name: setAndNumberMatch[1].trim(),
      setCode: setAndNumberMatch[2].trim().toUpperCase(),
      collectorNumber: setAndNumberMatch[3].trim(),
    };
  }

  const setOnlyMatch = remainder.match(new RegExp(`^(.*)\\s+\\((${SET_CODE_PATTERN})\\)\\s*$`));
  if (setOnlyMatch) {
    return {
      quantity,
      name: setOnlyMatch[1].trim(),
      setCode: setOnlyMatch[2].trim().toUpperCase(),
    };
  }

  const legacySetMatch = remainder.match(new RegExp(`^(.*)\\s+\\[(${SET_CODE_PATTERN})\\]\\s*$`));
  if (legacySetMatch) {
    return {
      quantity,
      name: legacySetMatch[1].trim(),
      setCode: legacySetMatch[2].trim().toUpperCase(),
    };
  }

  return {
    quantity,
    name: remainder.trim(),
  };
}

export function formatDecklistLine({ quantity, name, setCode, collectorNumber }: DecklistLineInput): string {
  const trimmedName = name.trim();
  if (!setCode) {
    return `${quantity} ${trimmedName}`;
  }

  if (collectorNumber) {
    return `${quantity} ${trimmedName} (${setCode}) ${collectorNumber}`;
  }

  return `${quantity} ${trimmedName} (${setCode})`;
}

export function buildPoolDecklistExport(entries: PoolExportEntry[]): string[] {
  const byScryfallId = new Map<
    string,
    { quantity: number; cachedCard: PoolExportEntry['cachedCard'] }
  >();

  for (const entry of entries) {
    if (entry.quantity < 1) {
      continue;
    }

    const scryfallId = entry.cachedCard.scryfallId;
    const existing = byScryfallId.get(scryfallId);
    if (existing) {
      existing.quantity += entry.quantity;
      continue;
    }

    byScryfallId.set(scryfallId, {
      quantity: entry.quantity,
      cachedCard: entry.cachedCard,
    });
  }

  const sorted = [...byScryfallId.values()].sort((left, right) => {
    const nameCompare = left.cachedCard.name.localeCompare(right.cachedCard.name, undefined, {
      sensitivity: 'base',
    });
    if (nameCompare !== 0) {
      return nameCompare;
    }

    const setCompare = left.cachedCard.setCode.localeCompare(right.cachedCard.setCode);
    if (setCompare !== 0) {
      return setCompare;
    }

    return (left.cachedCard.collectorNumber ?? '').localeCompare(right.cachedCard.collectorNumber ?? '');
  });

  return sorted.map(({ quantity, cachedCard }) =>
    formatDecklistLine({
      quantity,
      name: cachedCard.name,
      setCode: cachedCard.setCode,
      collectorNumber: cachedCard.collectorNumber ?? null,
    }),
  );
}
