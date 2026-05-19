const WUBRG = new Set(['W', 'U', 'B', 'R', 'G']);

export type DeckRowColorVariant = 'colorless' | 'mono' | 'gold';

export function getDeckRowColorVariant(colorIdentity: string[]): DeckRowColorVariant {
  const colors = colorIdentity
    .map((value) => value.toUpperCase())
    .filter((value) => WUBRG.has(value));
  const unique = [...new Set(colors)];

  if (unique.length === 0) {
    return 'colorless';
  }
  if (unique.length === 1) {
    return 'mono';
  }
  return 'gold';
}

export function getMonoColorKey(colorIdentity: string[]): 'W' | 'U' | 'B' | 'R' | 'G' | null {
  const colors = colorIdentity
    .map((value) => value.toUpperCase())
    .filter((value) => WUBRG.has(value));
  const unique = [...new Set(colors)];
  if (unique.length !== 1) {
    return null;
  }
  return unique[0] as 'W' | 'U' | 'B' | 'R' | 'G';
}

const MONO_CLASS: Record<'W' | 'U' | 'B' | 'R' | 'G', string> = {
  W: 'deck-row-tint-white',
  U: 'deck-row-tint-blue',
  B: 'deck-row-tint-black',
  R: 'deck-row-tint-red',
  G: 'deck-row-tint-green',
};

export function getDeckRowColorClasses(colorIdentity: string[]): string {
  const variant = getDeckRowColorVariant(colorIdentity);
  if (variant === 'colorless') {
    return 'deck-row-tint-colorless';
  }
  if (variant === 'gold') {
    return 'deck-row-tint-gold';
  }
  const monoKey = getMonoColorKey(colorIdentity);
  return monoKey ? MONO_CLASS[monoKey] : 'deck-row-tint-colorless';
}
