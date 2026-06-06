import { describe, expect, it } from 'vitest';
import { isPaperPrinting, resolveTypeLine } from '../../lib/scryfallCardNormalize.js';

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
