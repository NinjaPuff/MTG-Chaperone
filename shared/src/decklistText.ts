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

export type ParsedBulkItem = {
  /** Original trimmed line for failure reporting */
  inputLabel: string;
  name: string;
  quantity: number;
  setCode?: string;
  collectorNumber?: string;
};

const SET_CODE_PATTERN = '[A-Za-z0-9]{2,10}';
const FOIL_SUFFIX_PATTERN = /\s*(?:\*F\*|\s+F)\s*$/i;

const SECTION_HEADER_PATTERN =
  /^(?:deck|sideboard|side\s*board|sb|commander|commanders|companion|mainboard|main\s*deck|library|maybeboard|maybe\s*board|about)(?:\s*:)?$/i;

const CATEGORY_HEADER_PATTERN = /^[A-Za-z][A-Za-z\s/&'+-]*\s*\(\d+\)\s*$/;

const COMMENT_LINE_PATTERN = /^(?:#|\/\/)/;

const CSV_HEADER_PATTERN = /^"?quantityx?"?\s*,\s*"?name"?\s*,/i;

const TRAILING_CATEGORY_LABEL_PATTERN =
  /^((?:\d+\s*x?\s+)?.+?\([A-Za-z0-9]{2,10}\)\s+\S+)(?:\s+\[[^\]]+\])+\s*$/i;

const TRAILING_ARCHIDEKT_LABEL_PATTERN = /\s+\^[^\^]+\^(?:,#[0-9a-fA-F]{6})?\^?\s*$/;

function stripFoilSuffix(line: string) {
  return line.replace(FOIL_SUFFIX_PATTERN, '').trim();
}

function normalizeDecklistCharacters(line: string) {
  return line
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTrailingDeckbuilderMetadata(line: string) {
  let result = line
    .replace(
      /^((?:\d+\s*x?\s+)?.+?\([A-Za-z0-9]{2,10}\)\s+\S+)(?:\s+\*F\*)?\s+\[[A-Za-z][A-Za-z\s/&'+-]*\]\s*$/i,
      '$1',
    )
    .trim();
  result = result.replace(TRAILING_CATEGORY_LABEL_PATTERN, '$1').trim();
  return result.replace(TRAILING_ARCHIDEKT_LABEL_PATTERN, '').trim();
}

function normalizeCollectorNumber(collectorNumber: string | undefined) {
  if (!collectorNumber) {
    return undefined;
  }

  const trimmed = collectorNumber.trim();
  if (/^\d+$/.test(trimmed)) {
    return String(Number(trimmed));
  }

  return trimmed;
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

export function isDecklistSectionHeader(line: string) {
  return SECTION_HEADER_PATTERN.test(line.trim());
}

export function isDecklistCategoryHeader(line: string) {
  return CATEGORY_HEADER_PATTERN.test(line.trim());
}

export function isDecklistNonCardLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }

  if (COMMENT_LINE_PATTERN.test(trimmed)) {
    return true;
  }

  if (CSV_HEADER_PATTERN.test(trimmed)) {
    return true;
  }

  if (isDecklistSectionHeader(trimmed)) {
    return true;
  }

  if (isDecklistCategoryHeader(trimmed)) {
    return true;
  }

  return false;
}

function parseCsvFields(line: string) {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function tryParseCsvDecklistLine(line: string): ParsedBulkItem | null {
  if (!line.includes(',')) {
    return null;
  }

  const fields = parseCsvFields(line);
  if (fields.length < 2) {
    return null;
  }

  const quantityRaw = fields[0]?.replace(/x$/i, '').trim() ?? '';
  const name = fields[1]?.trim() ?? '';
  const setCode = fields[2]?.trim().toUpperCase() || undefined;

  if (!name || CSV_HEADER_PATTERN.test(line)) {
    return null;
  }

  if (!/^\d+$/.test(quantityRaw)) {
    return null;
  }

  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return null;
  }

  const cardName = setCode ? `${name} (${setCode})` : name;
  const inputLabel = `${quantity} ${cardName}`;

  return {
    inputLabel,
    name: cardName,
    quantity,
    setCode: setCode || undefined,
  };
}

export function expandCardNameLookupVariants(name: string): string[] {
  const trimmed = name.trim();
  const variants = [trimmed];
  if (trimmed.includes(' / ') && !trimmed.includes(' // ')) {
    variants.push(trimmed.replace(/ \/ /g, ' // '));
  }
  for (const variant of [...variants]) {
    if (!variant.includes(' // ')) {
      continue;
    }
    const parts = variant.split(' // ');
    if (parts.length !== 2) {
      continue;
    }
    const [left, right] = parts.map((part) => part.trim());
    if (!left || !right) {
      continue;
    }
    variants.push(left, right);
  }
  return [...new Set(variants)];
}

export function slashAliasKeysForIndexedName(name: string): string[] {
  const keys = [name];
  if (name.includes(' // ')) {
    keys.push(name.replace(/ \/\/ /g, ' / '));
  }
  return [...new Set(keys)];
}

export function parseDecklistLine(rawLine: string): ParsedDecklistLine {
  const normalized = stripTrailingDeckbuilderMetadata(
    stripFoilSuffix(normalizeDecklistCharacters(rawLine.trim())),
  );
  const { quantity, remainder } = parseQuantityAndRemainder(normalized);

  const setAndNumberMatch = remainder.match(
    new RegExp(`^(.*)\\s+\\((${SET_CODE_PATTERN})\\)\\s+([^\\s]+)\\s*$`),
  );
  if (setAndNumberMatch) {
    return {
      quantity,
      name: setAndNumberMatch[1].trim(),
      setCode: setAndNumberMatch[2].trim().toUpperCase(),
      collectorNumber: normalizeCollectorNumber(setAndNumberMatch[3].trim()),
    };
  }

  const bracketSetAndNumberMatch = remainder.match(
    new RegExp(`^(.*)\\s+\\[(${SET_CODE_PATTERN})\\]\\s+([^\\s]+)\\s*$`),
  );
  if (bracketSetAndNumberMatch) {
    return {
      quantity,
      name: bracketSetAndNumberMatch[1].trim(),
      setCode: bracketSetAndNumberMatch[2].trim().toUpperCase(),
      collectorNumber: normalizeCollectorNumber(bracketSetAndNumberMatch[3].trim()),
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

function toBulkItemInputLabel(parsed: ParsedDecklistLine) {
  if (parsed.setCode && parsed.collectorNumber) {
    return `${parsed.quantity} ${parsed.name} (${parsed.setCode}) ${parsed.collectorNumber}`;
  }
  if (parsed.setCode) {
    return `${parsed.quantity} ${parsed.name} (${parsed.setCode})`;
  }
  return `${parsed.quantity} ${parsed.name}`;
}

function toBulkItemName(parsed: ParsedDecklistLine) {
  if (parsed.setCode && parsed.collectorNumber) {
    return `${parsed.name} (${parsed.setCode}) ${parsed.collectorNumber}`;
  }
  if (parsed.setCode) {
    return `${parsed.name} (${parsed.setCode})`;
  }
  return parsed.name;
}

/**
 * Parse a multi-line bulk import paste from Arena, MTGO, Moxfield, Archidekt,
 * TappedOut, ManaBox, Delver Lens CSV, and similar deckbuilder exports.
 */
export function parseBulkDecklistText(input: string): ParsedBulkItem[] {
  const items: ParsedBulkItem[] = [];
  let stopParsing = false;

  for (const rawLine of input.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeDecklistCharacters(trimmed);
    if (/^about(?:\s*:)?$/i.test(normalized)) {
      stopParsing = true;
      continue;
    }

    if (stopParsing) {
      continue;
    }

    if (isDecklistNonCardLine(normalized)) {
      continue;
    }

    const csvItem = tryParseCsvDecklistLine(normalized);
    if (csvItem) {
      items.push(csvItem);
      continue;
    }

    const parsed = parseDecklistLine(normalized);
    if (!parsed.name || parsed.quantity < 1) {
      continue;
    }

    if (isDecklistSectionHeader(parsed.name) || isDecklistCategoryHeader(parsed.name)) {
      continue;
    }

    items.push({
      inputLabel: toBulkItemInputLabel(parsed),
      name: toBulkItemName(parsed),
      quantity: parsed.quantity,
      setCode: parsed.setCode,
      collectorNumber: parsed.collectorNumber,
    });
  }

  return items;
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
