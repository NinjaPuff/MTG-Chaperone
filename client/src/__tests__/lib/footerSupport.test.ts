import { describe, expect, it } from 'vitest';
import { resolveKofiSupportUrl } from '@/lib/footerSupport';

describe('resolveKofiSupportUrl', () => {
  it('returns null when env value is missing', () => {
    expect(resolveKofiSupportUrl(undefined)).toBeNull();
  });

  it('returns null when env value is whitespace only', () => {
    expect(resolveKofiSupportUrl('   ')).toBeNull();
  });

  it('returns trimmed URL when env value is set', () => {
    expect(resolveKofiSupportUrl('  https://ko-fi.com/example  ')).toBe('https://ko-fi.com/example');
  });
});
