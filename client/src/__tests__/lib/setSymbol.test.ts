import { describe, expect, it } from 'vitest';
import {
  MTG_VECTORS_PINNED_REF,
  mtgVectorsSymbolUrl,
  normalizeSetCode,
  resolveSetSymbolSources,
} from '@/lib/setSymbol';

describe('normalizeSetCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeSetCode('dmu')).toBe('DMU');
    expect(normalizeSetCode('  ecl  ')).toBe('ECL');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeSetCode('')).toBe('');
    expect(normalizeSetCode('   ')).toBe('');
  });
});

describe('mtgVectorsSymbolUrl', () => {
  it('builds WM url with uppercase code and pinned base', () => {
    const url = mtgVectorsSymbolUrl('dmu');
    expect(url).toContain(MTG_VECTORS_PINNED_REF);
    expect(url).toContain('/set/DMU/WM.svg');
  });

  it('supports rarity suffix', () => {
    expect(mtgVectorsSymbolUrl('dmu', 'C')).toMatch(/\/C\.svg$/);
  });
});

describe('resolveSetSymbolSources', () => {
  const scryfallUri = 'https://svgs.scryfall.io/sets/dmu.svg';

  it('returns scryfall img first, then mtg-vectors mask, then text', () => {
    const sources = resolveSetSymbolSources('DMU', scryfallUri);
    expect(sources).toEqual([
      { type: 'img', url: scryfallUri },
      { type: 'mask', url: mtgVectorsSymbolUrl('DMU') },
      { type: 'text' },
    ]);
  });

  it('uses mtg-vectors mask when scryfall uri is null', () => {
    const sources = resolveSetSymbolSources('DMU');
    expect(sources).toEqual([
      { type: 'mask', url: mtgVectorsSymbolUrl('DMU') },
      { type: 'text' },
    ]);
  });

  it('returns text-only for empty code', () => {
    expect(resolveSetSymbolSources('', null)).toEqual([{ type: 'text' }]);
  });
});
