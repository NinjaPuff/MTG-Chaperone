import { describe, expect, it } from 'vitest';
import { MIN_DECK_SIZES, minDeckSizeSelectOptions } from '../../lib/minDeckSize';

describe('minDeckSizeSelectOptions', () => {
  it('returns only 40 and 60 when the current size is valid', () => {
    expect(MIN_DECK_SIZES).toEqual([40, 60]);
    expect(minDeckSizeSelectOptions(40)).toEqual([
      { value: 40, label: '40' },
      { value: 60, label: '60' },
    ]);
  });

  it('prepends a pick-40-or-60 option for historical sizes', () => {
    expect(minDeckSizeSelectOptions(45)).toEqual([
      { value: 45, label: '45 (pick 40 or 60)' },
      { value: 40, label: '40' },
      { value: 60, label: '60' },
    ]);
  });
});
