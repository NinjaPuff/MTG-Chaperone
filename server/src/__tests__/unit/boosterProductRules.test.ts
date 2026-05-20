import { describe, expect, it } from 'vitest';
import { resolvePrimarySetCode } from '@mtg-league/shared';

describe('resolvePrimarySetCode', () => {
  it('returns explicit primary when it is in set codes', () => {
    expect(resolvePrimarySetCode(['SNC', 'STX'], 'STX')).toBe('STX');
  });

  it('matches primary case-insensitively', () => {
    expect(resolvePrimarySetCode(['SNC', 'STX'], 'stx')).toBe('STX');
  });

  it('falls back to sorted first when primary is null', () => {
    expect(resolvePrimarySetCode(['SNC', 'STX'], null)).toBe('SNC');
  });

  it('falls back to sorted first regardless of input order', () => {
    expect(resolvePrimarySetCode(['STX', 'SNC'], null)).toBe('SNC');
  });

  it('returns null for empty set codes', () => {
    expect(resolvePrimarySetCode([], 'STX')).toBeNull();
  });

  it('falls back when primary is not in set codes', () => {
    expect(resolvePrimarySetCode(['DMU'], 'MKM')).toBe('DMU');
  });
});
