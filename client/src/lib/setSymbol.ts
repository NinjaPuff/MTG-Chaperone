/** Pinned mtg-vectors release used as backup when Scryfall icons fail. */
export const MTG_VECTORS_PINNED_REF = '7864163149e814f036e48ba8ff8f4ff71633a060';

const MTG_VECTORS_BASE = `https://raw.githubusercontent.com/Investigamer/mtg-vectors/${MTG_VECTORS_PINNED_REF}/svg/optimized`;

export type SetSymbolRarity = 'WM' | 'C';

export type SetSymbolSource =
  | { type: 'img'; url: string }
  | { type: 'mask'; url: string }
  | { type: 'text' };

export function normalizeSetCode(code: string): string {
  return code.trim().toUpperCase();
}

export function mtgVectorsSymbolUrl(code: string, rarity: SetSymbolRarity = 'WM'): string {
  const normalized = normalizeSetCode(code);
  return `${MTG_VECTORS_BASE}/set/${normalized}/${rarity}.svg`;
}

/** Scryfall first, mtg-vectors backup, text last. */
export function resolveSetSymbolSources(
  code: string,
  scryfallIconUri?: string | null,
): SetSymbolSource[] {
  const normalized = normalizeSetCode(code);
  if (!normalized) {
    return [{ type: 'text' }];
  }

  const sources: SetSymbolSource[] = [];

  if (scryfallIconUri) {
    sources.push({ type: 'img', url: scryfallIconUri });
  }

  sources.push({ type: 'mask', url: mtgVectorsSymbolUrl(normalized) });
  sources.push({ type: 'text' });

  return sources;
}
