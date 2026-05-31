import { describe, expect, it } from 'vitest';
import {
  buildPoolDecklistExport,
  formatDecklistLine,
  parseDecklistLine,
} from '@mtg-league/shared';

describe('parseDecklistLine', () => {
  it('parses Arena full line with set and collector number', () => {
    expect(parseDecklistLine('2 Lightning Bolt (ECL) 112')).toEqual({
      quantity: 2,
      name: 'Lightning Bolt',
      setCode: 'ECL',
      collectorNumber: '112',
    });
  });

  it('parses set only without collector number', () => {
    expect(parseDecklistLine('2 Lightning Bolt (ECL)')).toEqual({
      quantity: 2,
      name: 'Lightning Bolt',
      setCode: 'ECL',
      collectorNumber: undefined,
    });
  });

  it('parses legacy bracket set suffix', () => {
    expect(parseDecklistLine('2 Lightning Bolt [ECL]')).toEqual({
      quantity: 2,
      name: 'Lightning Bolt',
      setCode: 'ECL',
      collectorNumber: undefined,
    });
  });

  it('parses name only lines', () => {
    expect(parseDecklistLine('2 Lightning Bolt')).toEqual({
      quantity: 2,
      name: 'Lightning Bolt',
      setCode: undefined,
      collectorNumber: undefined,
    });
  });

  it('normalizes Nx quantity prefix', () => {
    expect(parseDecklistLine('1x Lightning Bolt (ECL)')).toEqual({
      quantity: 1,
      name: 'Lightning Bolt',
      setCode: 'ECL',
      collectorNumber: undefined,
    });
  });

  it('strips trailing foil suffix before parsing', () => {
    expect(parseDecklistLine('1 Card (ECL) 112 *F*')).toEqual({
      quantity: 1,
      name: 'Card',
      setCode: 'ECL',
      collectorNumber: '112',
    });
  });

  it('preserves fractional collector numbers', () => {
    expect(parseDecklistLine('1 Banisher Priest (PRM) 1136/1158')).toEqual({
      quantity: 1,
      name: 'Banisher Priest',
      setCode: 'PRM',
      collectorNumber: '1136/1158',
    });
  });

  it('preserves double-faced card names with set at end', () => {
    expect(parseDecklistLine('1 Who // What // When // Where // Why (UNH) 136')).toEqual({
      quantity: 1,
      name: 'Who // What // When // Where // Why',
      setCode: 'UNH',
      collectorNumber: '136',
    });
  });
});

describe('formatDecklistLine', () => {
  it('formats full metadata', () => {
    expect(
      formatDecklistLine({
        quantity: 2,
        name: 'Lightning Bolt',
        setCode: 'ECL',
        collectorNumber: '112',
      }),
    ).toBe('2 Lightning Bolt (ECL) 112');
  });

  it('omits collector number when absent', () => {
    expect(
      formatDecklistLine({
        quantity: 1,
        name: 'Island',
        setCode: 'ECL',
        collectorNumber: null,
      }),
    ).toBe('1 Island (ECL)');
  });

  it('omits set when absent', () => {
    expect(
      formatDecklistLine({
        quantity: 4,
        name: 'Lightning Bolt',
        setCode: null,
        collectorNumber: null,
      }),
    ).toBe('4 Lightning Bolt');
  });
});

describe('parse/format round-trip', () => {
  it('is stable for lines with set and collector number', () => {
    const line = '2 Lightning Bolt (ECL) 112';
    const parsed = parseDecklistLine(line);
    expect(formatDecklistLine({ ...parsed, setCode: parsed.setCode ?? null, collectorNumber: parsed.collectorNumber ?? null })).toBe(line);
  });
});

describe('buildPoolDecklistExport', () => {
  it('emits separate lines for same name with different printings', () => {
    const lines = buildPoolDecklistExport([
      {
        quantity: 1,
        cachedCard: { scryfallId: 'a', name: 'Lightning Bolt', setCode: 'ECL', collectorNumber: '112' },
      },
      {
        quantity: 1,
        cachedCard: { scryfallId: 'b', name: 'Lightning Bolt', setCode: 'MH2', collectorNumber: '261' },
      },
    ]);

    expect(lines).toEqual(['1 Lightning Bolt (ECL) 112', '1 Lightning Bolt (MH2) 261']);
  });

  it('sums quantities for the same printing across entries', () => {
    const lines = buildPoolDecklistExport([
      {
        quantity: 2,
        cachedCard: { scryfallId: 'a', name: 'Island', setCode: 'ECL', collectorNumber: '289' },
      },
      {
        quantity: 1,
        cachedCard: { scryfallId: 'a', name: 'Island', setCode: 'ECL', collectorNumber: '289' },
      },
    ]);

    expect(lines).toEqual(['3 Island (ECL) 289']);
  });

  it('sorts lines alphabetically by name', () => {
    const lines = buildPoolDecklistExport([
      {
        quantity: 1,
        cachedCard: { scryfallId: 'b', name: 'Island', setCode: 'ECL', collectorNumber: '1' },
      },
      {
        quantity: 1,
        cachedCard: { scryfallId: 'a', name: 'Forest', setCode: 'ECL', collectorNumber: '2' },
      },
    ]);

    expect(lines).toEqual(['1 Forest (ECL) 2', '1 Island (ECL) 1']);
  });

  it('omits collector number when missing from cache', () => {
    const lines = buildPoolDecklistExport([
      {
        quantity: 1,
        cachedCard: { scryfallId: 'a', name: 'Island', setCode: 'ECL', collectorNumber: null },
      },
    ]);

    expect(lines).toEqual(['1 Island (ECL)']);
  });
});
