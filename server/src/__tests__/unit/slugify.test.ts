import { describe, expect, it } from 'vitest';
import { slugify, withSlugSuffix } from '../../lib/slugify.js';

describe('slugify', () => {
  it('normalizes case and separators', () => {
    expect(slugify(' Friday Night Magic ')).toBe('friday-night-magic');
  });

  it('falls back to item for empty slug', () => {
    expect(slugify('!!!')).toBe('item');
  });
});

describe('withSlugSuffix', () => {
  it('appends sanitized lowercase suffix', () => {
    expect(withSlugSuffix('league', 'ABC_123!')).toBe('league-abc123');
  });
});
