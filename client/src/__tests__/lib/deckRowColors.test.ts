import { describe, expect, it } from 'vitest';
import { getDeckRowColorClasses, getDeckRowColorVariant } from '../../lib/deckRowColors';

describe('getDeckRowColorVariant', () => {
  it('returns colorless for empty identity', () => {
    expect(getDeckRowColorVariant([])).toBe('colorless');
  });

  it('returns mono for single WUBRG color', () => {
    expect(getDeckRowColorVariant(['R'])).toBe('mono');
  });

  it('returns gold for two or more colors', () => {
    expect(getDeckRowColorVariant(['W', 'U'])).toBe('gold');
    expect(getDeckRowColorVariant(['W', 'U', 'B'])).toBe('gold');
  });

  it('returns colorless for non-WUBRG identity only', () => {
    expect(getDeckRowColorVariant(['C'])).toBe('colorless');
  });
});

describe('getDeckRowColorClasses', () => {
  it('returns colorless class for empty identity', () => {
    expect(getDeckRowColorClasses([])).toBe('deck-row-tint-colorless');
  });

  it('returns red class for mono red', () => {
    expect(getDeckRowColorClasses(['R'])).toBe('deck-row-tint-red');
  });

  it('returns gold class for multicolor', () => {
    expect(getDeckRowColorClasses(['W', 'U'])).toBe('deck-row-tint-gold');
  });
});
