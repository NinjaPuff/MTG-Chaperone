export const CARD_IMAGE_WIDTH_MIN = 160;
export const CARD_IMAGE_WIDTH_MAX = 280;
export const CARD_IMAGE_WIDTH_DEFAULT = 220;
export const CARD_IMAGE_WIDTH_STORAGE_KEY = 'cardpool-stacks-width';

export function clampCardImageWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return CARD_IMAGE_WIDTH_DEFAULT;
  }
  return Math.max(CARD_IMAGE_WIDTH_MIN, Math.min(CARD_IMAGE_WIDTH_MAX, value));
}

export function readStoredCardImageWidth(): number {
  if (typeof window === 'undefined') {
    return CARD_IMAGE_WIDTH_DEFAULT;
  }

  const stored = window.localStorage.getItem(CARD_IMAGE_WIDTH_STORAGE_KEY);
  if (!stored) {
    return CARD_IMAGE_WIDTH_DEFAULT;
  }

  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) {
    return CARD_IMAGE_WIDTH_DEFAULT;
  }

  return clampCardImageWidth(parsed);
}
