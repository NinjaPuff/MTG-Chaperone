import { describe, expect, it } from 'vitest';
import { resolveCreatePrimarySetCode } from '@/lib/boosterProductCreate';

describe('resolveCreatePrimarySetCode', () => {
  it('returns seed when it is in set codes', () => {
    expect(resolveCreatePrimarySetCode(['stx'], ['SNC', 'STX'])).toBe('STX');
  });

  it('returns undefined when seed is not in set codes', () => {
    expect(resolveCreatePrimarySetCode(['STX'], ['SNC', 'SOA'])).toBeUndefined();
  });

  it('returns undefined when seed is empty', () => {
    expect(resolveCreatePrimarySetCode([], ['DMU'])).toBeUndefined();
  });

  it('returns undefined when set codes are empty', () => {
    expect(resolveCreatePrimarySetCode(['STX'], [])).toBeUndefined();
  });

  it('matches seed case-insensitively', () => {
    expect(resolveCreatePrimarySetCode(['stx'], ['STX'])).toBe('STX');
  });
});
