import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCardImageWidth } from '../../hooks/useCardImageWidth';
import { CARD_IMAGE_WIDTH_MAX, CARD_IMAGE_WIDTH_STORAGE_KEY } from '../../lib/cardImageWidth';

describe('useCardImageWidth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should_initialize_from_stored_value_when_present', () => {
    localStorage.setItem(CARD_IMAGE_WIDTH_STORAGE_KEY, '240');

    const { result } = renderHook(() => useCardImageWidth());

    expect(result.current.cardImageWidth).toBe(240);
  });

  it('should_persist_when_setCardImageWidth_called', () => {
    const { result } = renderHook(() => useCardImageWidth());

    act(() => {
      result.current.setCardImageWidth(200);
    });

    expect(result.current.cardImageWidth).toBe(200);
    expect(localStorage.getItem(CARD_IMAGE_WIDTH_STORAGE_KEY)).toBe('200');
  });

  it('should_clamp_on_set', () => {
    const { result } = renderHook(() => useCardImageWidth());

    act(() => {
      result.current.setCardImageWidth(999);
    });

    expect(result.current.cardImageWidth).toBe(CARD_IMAGE_WIDTH_MAX);
    expect(localStorage.getItem(CARD_IMAGE_WIDTH_STORAGE_KEY)).toBe(String(CARD_IMAGE_WIDTH_MAX));
  });
});
