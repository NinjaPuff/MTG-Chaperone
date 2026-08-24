import { describe, expect, it } from 'vitest';
import {
  isLandTypeLine,
  isPaperPrinting,
  needsFaceCmcRefresh,
  resolveCmc,
  resolveTypeLine,
} from '../../lib/scryfallCardNormalize.js';

describe('isPaperPrinting', () => {
  it('returns false for digital-only cards', () => {
    expect(isPaperPrinting({ digital: true, games: ['arena'] })).toBe(false);
  });

  it('returns false for arena-only cards not flagged digital', () => {
    expect(isPaperPrinting({ digital: false, games: ['arena'] })).toBe(false);
  });

  it('returns true for paper and arena printings', () => {
    expect(isPaperPrinting({ digital: false, games: ['paper', 'arena', 'mtgo'] })).toBe(true);
  });

  it('returns true when fields are missing (legacy fixtures)', () => {
    expect(isPaperPrinting({})).toBe(true);
  });

  it('returns true when games is missing but digital is false', () => {
    expect(isPaperPrinting({ digital: false })).toBe(true);
  });
});

describe('resolveTypeLine', () => {
  it('uses top-level type_line when present', () => {
    expect(resolveTypeLine({ type_line: 'Instant' })).toBe('Instant');
  });

  it('trims whitespace on top-level type_line', () => {
    expect(resolveTypeLine({ type_line: '  Creature — Elf  ' })).toBe('Creature — Elf');
  });

  it('uses first face type_line for ECL-style reversible_card', () => {
    expect(
      resolveTypeLine({
        card_faces: [
          { type_line: 'Land — Swamp Mountain' },
          { type_line: 'Land — Swamp Mountain' },
        ],
      }),
    ).toBe('Land — Swamp Mountain');
  });

  it('uses first face type_line for TDM-style reversible_card', () => {
    expect(
      resolveTypeLine({
        card_faces: [{ type_line: 'Creature — Dragon' }, { type_line: 'Sorcery — Omen' }],
      }),
    ).toBe('Creature — Dragon');
  });

  it('falls back to Card when type_line missing everywhere', () => {
    expect(resolveTypeLine({})).toBe('Card');
    expect(resolveTypeLine({ card_faces: [{ name: 'x' } as { type_line?: string }] })).toBe('Card');
  });
});

describe('resolveCmc', () => {
  it('uses top-level cmc when present', () => {
    expect(resolveCmc({ cmc: 4, card_faces: [{ cmc: 3 }] })).toBe(4);
  });

  it('should_keep_zero_when_top_level_cmc_is_zero', () => {
    expect(resolveCmc({ cmc: 0, card_faces: [{ cmc: 3 }] })).toBe(0);
  });

  it('uses first face cmc when top-level cmc is missing', () => {
    expect(resolveCmc({ card_faces: [{ cmc: 3 }, { cmc: 5 }] })).toBe(3);
  });

  it('falls back to zero when cmc is missing everywhere', () => {
    expect(resolveCmc({})).toBe(0);
  });
});

describe('needsFaceCmcRefresh', () => {
  it('refreshes stale double-faced entries with missing manaCost and positive cmc', () => {
    expect(
      needsFaceCmcRefresh({
        name: 'Trystan, Callous Cultivator // Trystan, Penitent Culler',
        layout: 'transform',
        manaCost: null,
        cmc: 3,
        typeLine: 'Legendary Creature — Human',
      }),
    ).toBe(true);
  });

  it('refreshes reversible nonlands when cached cmc is zero', () => {
    expect(
      needsFaceCmcRefresh({
        name: 'Clarion Conqueror // Clarion Conqueror',
        layout: 'reversible_card',
        manaCost: '{2}{W}',
        cmc: 0,
        typeLine: 'Creature — Dragon',
      }),
    ).toBe(true);
  });

  it('does not refresh reversible lands when cached cmc is zero', () => {
    expect(
      needsFaceCmcRefresh({
        name: 'Blood Crypt // Blood Crypt',
        layout: 'reversible_card',
        manaCost: null,
        cmc: 0,
        typeLine: 'Land — Swamp Mountain',
      }),
    ).toBe(false);
  });
});

describe('isLandTypeLine', () => {
  it('returns true for land type lines', () => {
    expect(isLandTypeLine('Land — Swamp Mountain')).toBe(true);
  });

  it('returns false for non-land type lines', () => {
    expect(isLandTypeLine('Creature — Dragon')).toBe(false);
  });
});
