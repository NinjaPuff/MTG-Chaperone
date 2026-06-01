import { describe, expect, it } from 'vitest';
import { resolveTypeLine } from '../../lib/scryfallCardNormalize.js';

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
