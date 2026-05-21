import { describe, expect, it } from 'vitest';
import { hasRemovedSetCodes } from '../../lib/boosterProductEditGuards';

describe('boosterProductEditGuards', () => {
  it('returns false when sets are unchanged or only added', () => {
    expect(hasRemovedSetCodes(['MKM', 'LCI'], ['MKM', 'LCI'])).toBe(false);
    expect(hasRemovedSetCodes(['MKM'], ['MKM', 'LCI'])).toBe(false);
  });

  it('returns true when a set code was removed', () => {
    expect(hasRemovedSetCodes(['MKM', 'LCI'], ['MKM'])).toBe(true);
    expect(hasRemovedSetCodes(['MKM', 'LCI'], [])).toBe(true);
  });
});
