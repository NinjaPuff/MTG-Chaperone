import { beforeEach, describe, expect, it } from 'vitest';
import {
  CARD_IMAGE_WIDTH_DEFAULT,
  CARD_IMAGE_WIDTH_MAX,
  CARD_IMAGE_WIDTH_MIN,
  CARD_IMAGE_WIDTH_STORAGE_KEY,
  clampCardImageWidth,
  readStoredCardImageWidth,
} from '../../lib/cardImageWidth';

describe('cardImageWidth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should_return_default_when_storage_is_null', () => {
    expect(readStoredCardImageWidth()).toBe(CARD_IMAGE_WIDTH_DEFAULT);
  });

  it('should_clamp_stored_value_above_max_to_280', () => {
    localStorage.setItem(CARD_IMAGE_WIDTH_STORAGE_KEY, '500');
    expect(readStoredCardImageWidth()).toBe(CARD_IMAGE_WIDTH_MAX);
  });

  it('should_clamp_stored_value_below_min_to_160', () => {
    localStorage.setItem(CARD_IMAGE_WIDTH_STORAGE_KEY, '100');
    expect(readStoredCardImageWidth()).toBe(CARD_IMAGE_WIDTH_MIN);
  });

  it('should_return_default_when_storage_is_non_numeric', () => {
    localStorage.setItem(CARD_IMAGE_WIDTH_STORAGE_KEY, 'abc');
    expect(readStoredCardImageWidth()).toBe(CARD_IMAGE_WIDTH_DEFAULT);
  });

  it('should_clamp_arbitrary_number_in_clampCardImageWidth', () => {
    expect(clampCardImageWidth(999)).toBe(CARD_IMAGE_WIDTH_MAX);
    expect(clampCardImageWidth(50)).toBe(CARD_IMAGE_WIDTH_MIN);
    expect(clampCardImageWidth(200)).toBe(200);
  });
});
