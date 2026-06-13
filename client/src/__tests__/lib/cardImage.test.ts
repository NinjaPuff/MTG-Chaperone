import { describe, expect, it } from 'vitest';
import { getCardImageCandidates, getFaceImageCandidates, getPrimaryCardImageUrl } from '../../lib/cardImage';

describe('cardImage', () => {
  it('returns default ordered candidates', () => {
    const imageUris = {
      normal: 'https://a/n.jpg',
      border_crop: 'https://a/bc.jpg',
      small: 'https://a/s.jpg',
    };

    expect(getCardImageCandidates(imageUris)).toEqual(['https://a/n.jpg', 'https://a/bc.jpg', 'https://a/s.jpg']);
  });

  it('uses custom preference order', () => {
    const imageUris = {
      normal: 'https://a/n.jpg',
      border_crop: 'https://a/bc.jpg',
      small: 'https://a/s.jpg',
    };

    expect(getCardImageCandidates(imageUris, ['border_crop', 'normal'])).toEqual(['https://a/bc.jpg', 'https://a/n.jpg']);
  });

  it('dedupes identical URLs', () => {
    const imageUris = {
      normal: 'https://same',
      border_crop: 'https://same',
      small: 'https://small',
    };

    expect(getCardImageCandidates(imageUris)).toEqual(['https://same', 'https://small']);
  });

  it('skips non-string values', () => {
    const imageUris = {
      normal: 123,
      small: 'https://a/s.jpg',
    } as unknown as Record<string, string>;

    expect(getCardImageCandidates(imageUris)).toEqual(['https://a/s.jpg']);
  });

  it('supports partial sizes with a custom preference', () => {
    const imageUris = {
      small: 'https://a/s.jpg',
    };

    expect(getCardImageCandidates(imageUris, ['border_crop', 'normal', 'small'])).toEqual(['https://a/s.jpg']);
  });

  it('returns null/empty for missing image data', () => {
    expect(getCardImageCandidates(null)).toEqual([]);
    expect(getCardImageCandidates({})).toEqual([]);
    expect(getPrimaryCardImageUrl(null)).toBeNull();
  });

  it('returns first candidate as primary URL', () => {
    const imageUris = {
      normal: 'https://a/n.jpg',
      border_crop: 'https://a/bc.jpg',
    };

    expect(getPrimaryCardImageUrl(imageUris)).toBe('https://a/n.jpg');
    expect(getPrimaryCardImageUrl(imageUris, ['border_crop', 'normal'])).toBe('https://a/bc.jpg');
  });

  it('returns face image candidates in normal/small order', () => {
    expect(getFaceImageCandidates({ normal: 'https://a/n.jpg', small: 'https://a/s.jpg' })).toEqual([
      'https://a/n.jpg',
      'https://a/s.jpg',
    ]);
  });
});
