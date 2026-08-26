import { describe, expect, it } from 'vitest';
import {
  buildPoolDecklistExport,
  expandCardNameLookupVariants,
  formatArchidektDecklistText,
  formatDecklistLine,
  formatMoxfieldDecklistText,
  isDecklistNonCardLine,
  parseBulkDecklistText,
  parseDecklistLine,
  slashAliasKeysForIndexedName,
  type DeckExportEntry,
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
    expect(parseDecklistLine('1 Card (ECL) 112 F')).toEqual({
      quantity: 1,
      name: 'Card',
      setCode: 'ECL',
      collectorNumber: '112',
    });
  });

  it('does not strip trailing F that is part of the card name', () => {
    expect(parseDecklistLine('1 Stand Up for Yourself')).toEqual({
      quantity: 1,
      name: 'Stand Up for Yourself',
      setCode: undefined,
      collectorNumber: undefined,
    });
    expect(parseDecklistLine('1 Belief')).toEqual({
      quantity: 1,
      name: 'Belief',
      setCode: undefined,
      collectorNumber: undefined,
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

  it('parses bracket set with collector number', () => {
    expect(parseDecklistLine('1 Lightning Bolt [M10] 146')).toEqual({
      quantity: 1,
      name: 'Lightning Bolt',
      setCode: 'M10',
      collectorNumber: '146',
    });
  });

  it('strips leading zeros from numeric collector numbers', () => {
    expect(parseDecklistLine('1 Island (ECL) 0289')).toEqual({
      quantity: 1,
      name: 'Island',
      setCode: 'ECL',
      collectorNumber: '289',
    });
  });

  it('normalizes smart apostrophes in card names', () => {
    expect(parseDecklistLine('1 Ajani\u2019s Response (SOS) 6')).toEqual({
      quantity: 1,
      name: "Ajani's Response",
      setCode: 'SOS',
      collectorNumber: '6',
    });
  });

  it('parses tab-separated Arena export lines', () => {
    expect(parseDecklistLine('4 Lightning Bolt\t(M10)\t146')).toEqual({
      quantity: 4,
      name: 'Lightning Bolt',
      setCode: 'M10',
      collectorNumber: '146',
    });
  });

  it('strips Archidekt category labels after printing metadata', () => {
    expect(parseDecklistLine('1 Sol Ring (CMM) 162 *F* [Artifact]')).toEqual({
      quantity: 1,
      name: 'Sol Ring',
      setCode: 'CMM',
      collectorNumber: '162',
    });
  });

  it('parses PLST collector numbers with set prefix', () => {
    expect(parseDecklistLine('1 Abrade (PLST) 2XM-114')).toEqual({
      quantity: 1,
      name: 'Abrade',
      setCode: 'PLST',
      collectorNumber: '2XM-114',
    });
  });
});

describe('isDecklistNonCardLine', () => {
  it('skips Arena and MTGO section headers', () => {
    expect(isDecklistNonCardLine('Deck')).toBe(true);
    expect(isDecklistNonCardLine('Sideboard')).toBe(true);
    expect(isDecklistNonCardLine('Side Board:')).toBe(true);
    expect(isDecklistNonCardLine('SB:')).toBe(true);
    expect(isDecklistNonCardLine('Commander')).toBe(true);
    expect(isDecklistNonCardLine('Companion')).toBe(true);
  });

  it('skips Archidekt category headers', () => {
    expect(isDecklistNonCardLine('Creatures (23)')).toBe(true);
    expect(isDecklistNonCardLine('Instants & Sorceries (12)')).toBe(true);
  });

  it('skips comments and CSV headers', () => {
    expect(isDecklistNonCardLine('// sideboard tech')).toBe(true);
    expect(isDecklistNonCardLine('# notes')).toBe(true);
    expect(isDecklistNonCardLine('QuantityX,Name,Edition code,Foil')).toBe(true);
  });

  it('does not skip card lines', () => {
    expect(isDecklistNonCardLine('4 Lightning Bolt (M10) 146')).toBe(false);
    expect(isDecklistNonCardLine('Stand Up for Yourself')).toBe(false);
  });
});

describe('parseBulkDecklistText platform exports', () => {
  it('parses MTG Arena export with sections and sideboard', () => {
    const input = `Commander
1 Atraxa, Praetors' Voice (MKC) 127

Deck
4 Lightning Bolt (M10) 146
2 Defiant Strike (WAR) 9

Sideboard
2 Negate (M21) 266`;

    expect(parseBulkDecklistText(input)).toEqual([
      { inputLabel: "1 Atraxa, Praetors' Voice (MKC) 127", name: "Atraxa, Praetors' Voice (MKC) 127", quantity: 1, setCode: 'MKC', collectorNumber: '127' },
      { inputLabel: '4 Lightning Bolt (M10) 146', name: 'Lightning Bolt (M10) 146', quantity: 4, setCode: 'M10', collectorNumber: '146' },
      { inputLabel: '2 Defiant Strike (WAR) 9', name: 'Defiant Strike (WAR) 9', quantity: 2, setCode: 'WAR', collectorNumber: '9' },
      { inputLabel: '2 Negate (M21) 266', name: 'Negate (M21) 266', quantity: 2, setCode: 'M21', collectorNumber: '266' },
    ]);
  });

  it('parses MTGO plain name-only export', () => {
    const input = `4 Tarmogoyf
3 Verdant Catacombs
1 Stand Up for Yourself`;

    expect(parseBulkDecklistText(input)).toEqual([
      { inputLabel: '4 Tarmogoyf', name: 'Tarmogoyf', quantity: 4 },
      { inputLabel: '3 Verdant Catacombs', name: 'Verdant Catacombs', quantity: 3 },
      { inputLabel: '1 Stand Up for Yourself', name: 'Stand Up for Yourself', quantity: 1 },
    ]);
  });

  it('parses Moxfield MTGO-style export with set codes', () => {
    const input = `1 Stand Up for Yourself (SOS) 34
1 Abrade (PLST) 2XM-114
1 Abigale, Poet Laureate / Heroic Stanza (SOS) 170`;

    const items = parseBulkDecklistText(input);
    expect(items).toHaveLength(3);
    expect(items[0]?.name).toBe('Stand Up for Yourself (SOS) 34');
    expect(items[1]?.name).toBe('Abrade (PLST) 2XM-114');
    expect(items[2]?.name).toBe('Abigale, Poet Laureate / Heroic Stanza (SOS) 170');
  });

  it('parses Delver Lens CSV export rows', () => {
    const input = `"QuantityX","Name","Edition code","Foil"
"1x","Knight of the Ebon Legion","M20",""
"2x","Lightning Bolt","M10",""`;

    expect(parseBulkDecklistText(input)).toEqual([
      { inputLabel: '1 Knight of the Ebon Legion (M20)', name: 'Knight of the Ebon Legion (M20)', quantity: 1, setCode: 'M20' },
      { inputLabel: '2 Lightning Bolt (M10)', name: 'Lightning Bolt (M10)', quantity: 2, setCode: 'M10' },
    ]);
  });

  it('ignores About section and trailing notes from Arena exports', () => {
    const input = `Deck
1 Island (ECL) 289

About
Built for testing`;

    expect(parseBulkDecklistText(input)).toEqual([
      { inputLabel: '1 Island (ECL) 289', name: 'Island (ECL) 289', quantity: 1, setCode: 'ECL', collectorNumber: '289' },
    ]);
  });

  it('parses name-only lines without explicit quantity as singletons', () => {
    expect(parseBulkDecklistText('Lightning Bolt')).toEqual([
      { inputLabel: '1 Lightning Bolt', name: 'Lightning Bolt', quantity: 1 },
    ]);
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

const exportEntries: DeckExportEntry[] = [
  {
    quantity: 1,
    name: 'Brainstorm',
    setCode: 'ICE',
    collectorNumber: '61',
    zone: 'main',
  },
  {
    quantity: 4,
    name: 'Island',
    setCode: 'USG',
    collectorNumber: '335',
    zone: 'main',
  },
  {
    quantity: 2,
    name: 'Hydroblast',
    setCode: 'ICE',
    collectorNumber: '72',
    zone: 'sideboard',
  },
];

describe('formatMoxfieldDecklistText', () => {
  it('emits Deck then Sideboard with Arena-style lines sorted by name within zone', () => {
    expect(formatMoxfieldDecklistText(exportEntries)).toBe(
      ['Deck', '1 Brainstorm (ICE) 61', '4 Island (USG) 335', '', 'Sideboard', '2 Hydroblast (ICE) 72'].join('\n'),
    );
  });

  it('omits the Sideboard block when empty', () => {
    expect(formatMoxfieldDecklistText(exportEntries.filter((entry) => entry.zone === 'main'))).toBe(
      ['Deck', '1 Brainstorm (ICE) 61', '4 Island (USG) 335'].join('\n'),
    );
  });

  it('omits collector number then set when missing, and keeps DFC names as stored', () => {
    expect(
      formatMoxfieldDecklistText([
        { quantity: 1, name: 'Front // Back', setCode: 'MH2', collectorNumber: null, zone: 'main' },
        { quantity: 2, name: 'Shock', setCode: null, collectorNumber: '1', zone: 'main' },
      ]),
    ).toBe(['Deck', '1 Front // Back (MH2)', '2 Shock'].join('\n'));
  });

  it('round-trips through parseBulkDecklistText', () => {
    const text = formatMoxfieldDecklistText(exportEntries);
    expect(parseBulkDecklistText(text)).toEqual([
      {
        inputLabel: '1 Brainstorm (ICE) 61',
        name: 'Brainstorm (ICE) 61',
        quantity: 1,
        setCode: 'ICE',
        collectorNumber: '61',
      },
      {
        inputLabel: '4 Island (USG) 335',
        name: 'Island (USG) 335',
        quantity: 4,
        setCode: 'USG',
        collectorNumber: '335',
      },
      {
        inputLabel: '2 Hydroblast (ICE) 72',
        name: 'Hydroblast (ICE) 72',
        quantity: 2,
        setCode: 'ICE',
        collectorNumber: '72',
      },
    ]);
  });
});

describe('formatArchidektDecklistText', () => {
  it('uses Nx quantity prefixes with the same sections and sort', () => {
    expect(formatArchidektDecklistText(exportEntries)).toBe(
      ['Deck', '1x Brainstorm (ICE) 61', '4x Island (USG) 335', '', 'Sideboard', '2x Hydroblast (ICE) 72'].join('\n'),
    );
  });

  it('round-trips Nx lines through parseBulkDecklistText', () => {
    const items = parseBulkDecklistText(formatArchidektDecklistText(exportEntries));
    expect(items.map((item) => item.quantity)).toEqual([1, 4, 2]);
    expect(items.map((item) => item.setCode)).toEqual(['ICE', 'USG', 'ICE']);
    expect(items[0]?.name).toContain('Brainstorm');
    expect(items[1]?.name).toContain('Island');
    expect(items[2]?.name).toContain('Hydroblast');
  });
});
