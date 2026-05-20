function normalizeSetCodes(setCodes: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const code of setCodes) {
    const upper = code.trim().toUpperCase();
    if (!upper || seen.has(upper)) {
      continue;
    }
    seen.add(upper);
    normalized.push(upper);
  }

  return normalized.sort((a, b) => a.localeCompare(b));
}

export function resolvePrimarySetCode(
  setCodes: string[],
  primarySetCode?: string | null,
): string | null {
  const codes = normalizeSetCodes(setCodes);
  if (codes.length === 0) {
    return null;
  }

  const normalizedPrimary = primarySetCode?.trim().toUpperCase();
  if (normalizedPrimary && codes.includes(normalizedPrimary)) {
    return normalizedPrimary;
  }

  return codes[0] ?? null;
}
