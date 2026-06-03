import { describe, expect, it } from 'vitest';
import {
  buildPoolDecklistExport,
  expandCardNameLookupVariants,
  formatDecklistLine,
  parseDecklistLine,
  slashAliasKeysForIndexedName,
} from '@mtg-league/shared';

const trystanCanonical = 'Trystan, Callous Cultivator // Trystan, Penitent Culler';
const trystanMisexport = 'Trystan, Callous Cultivator / Trystan, Penitent Culler';

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

  it('preserves single-slash DFC misexport in parsed name', () => {
    expect(
      parseDecklistLine('1 Trystan, Callous Cultivator / Trystan, Penitent Culler (TST) 112'),
    ).toEqual({
      quantity: 1,
      name: trystanMisexport,
      setCode: 'TST',
      collectorNumber: '112',
    });
  });
});

describe('card name slash lookup helpers', () => {
  describe('expandCardNameLookupVariants', () => {
    it('adds canonical // variant for spaced single-slash DFC misexport', () => {
      expect(expandCardNameLookupVariants(trystanMisexport)).toEqual([
        trystanMisexport,
        trystanCanonical,
        'Trystan, Callous Cultivator',
        'Trystan, Penitent Culler',
      ]);
    });

    it('replaces every spaced single slash for multi-face misexport', () => {
      const misexport = 'Who / What / When / Where / Why';
      const variants = expandCardNameLookupVariants(misexport);
      expect(variants).toHaveLength(2);
      expect(variants[0]).toBe(misexport);
      expect(variants[1]).toBe('Who // What // When // Where // Why');
    });

    it('returns only canonical name when already using // separator', () => {
      expect(expandCardNameLookupVariants('Heartflame Duelist // Heartflame Slash')).toEqual([
        'Heartflame Duelist // Heartflame Slash',
        'Heartflame Duelist',
        'Heartflame Slash',
      ]);
    });

    it('does not expand slashes without surrounding spaces', () => {
      expect(expandCardNameLookupVariants('Summon: Choco/Mog')).toEqual(['Summon: Choco/Mog']);
    });

    it('does not expand SP//dr style names', () => {
      expect(expandCardNameLookupVariants('SP//dr, Piloted by Peni')).toEqual([
        'SP//dr, Piloted by Peni',
      ]);
    });

    it('trims whitespace before expanding', () => {
      expect(expandCardNameLookupVariants(`  ${trystanMisexport}  `)).toEqual([
        trystanMisexport,
        trystanCanonical,
        'Trystan, Callous Cultivator',
        'Trystan, Penitent Culler',
      ]);
    });

    it('is idempotent for canonical DFC names', () => {
      expect(expandCardNameLookupVariants(trystanCanonical)).toEqual([
        trystanCanonical,
        'Trystan, Callous Cultivator',
        'Trystan, Penitent Culler',
      ]);
    });

    it('splits two-part double-slash names into halves', () => {
      expect(expandCardNameLookupVariants('Hero of Light // Adeline, Resplendent Cathar')).toEqual([
        'Hero of Light // Adeline, Resplendent Cathar',
        'Hero of Light',
        'Adeline, Resplendent Cathar',
      ]);
    });

    it('does not split names with three or more // parts', () => {
      expect(expandCardNameLookupVariants('Who // What // When // Where // Why')).toEqual([
        'Who // What // When // Where // Why',
      ]);
    });

    it('does not produce empty halves when one side is blank', () => {
      expect(expandCardNameLookupVariants(' // Something')).toEqual(['// Something']);
    });

    it('combines spaced single-slash expansion with half splitting', () => {
      expect(expandCardNameLookupVariants('Front / Back')).toEqual([
        'Front / Back',
        'Front // Back',
        'Front',
        'Back',
      ]);
    });
  });

  describe('slashAliasKeysForIndexedName', () => {
    it('includes single-slash alias for canonical DFC names', () => {
      const keys = slashAliasKeysForIndexedName(trystanCanonical);
      expect(keys).toContain(trystanCanonical);
      expect(keys).toContain(trystanMisexport);
    });

    it('does not reverse-expand misexport-only names', () => {
      expect(slashAliasKeysForIndexedName(trystanMisexport)).toEqual([trystanMisexport]);
    });

    it('does not add aliases for SP//dr style names', () => {
      expect(slashAliasKeysForIndexedName('SP//dr, Piloted by Peni')).toEqual([
        'SP//dr, Piloted by Peni',
      ]);
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

  it('exports oracle name not flavor alias', () => {
    const lines = buildPoolDecklistExport([
      {
        quantity: 2,
        cachedCard: {
          scryfallId: '0b9579d8-bc8f-4d74-bfc1-dcdd42568f79',
          name: 'Adeline, Resplendent Cathar',
          setCode: 'FCA',
          collectorNumber: '1',
        },
      },
    ]);

    expect(lines).toEqual(['2 Adeline, Resplendent Cathar (FCA) 1']);
  });
});
