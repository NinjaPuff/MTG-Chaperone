import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeReturnUrl,
  RETURN_URL_STORAGE_KEY,
  sanitizeReturnUrl,
  storeReturnUrl,
} from '../../lib/returnUrl';

describe('sanitizeReturnUrl', () => {
  it('accepts same-app relative paths with query strings', () => {
    expect(sanitizeReturnUrl('/join?token=abc123')).toBe('/join?token=abc123');
  });

  it('accepts simple relative paths', () => {
    expect(sanitizeReturnUrl('/profile')).toBe('/profile');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeReturnUrl('//evil.com')).toBeNull();
  });

  it('rejects absolute https URLs', () => {
    expect(sanitizeReturnUrl('https://evil.com')).toBeNull();
  });

  it('rejects javascript URLs', () => {
    expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects empty string and null', () => {
    expect(sanitizeReturnUrl('')).toBeNull();
    expect(sanitizeReturnUrl(null)).toBeNull();
  });
});

describe('storeReturnUrl and consumeReturnUrl', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a valid URL and clears storage after consume', () => {
    storeReturnUrl('/join?token=abc123');
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe('/join?token=abc123');

    expect(consumeReturnUrl()).toBe('/join?token=abc123');
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(consumeReturnUrl()).toBeNull();
  });

  it('does not store invalid URLs', () => {
    storeReturnUrl('https://evil.com');
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
    expect(consumeReturnUrl()).toBeNull();
  });
});
