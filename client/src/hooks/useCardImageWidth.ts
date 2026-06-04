import { useEffect, useState } from 'react';
import {
  CARD_IMAGE_WIDTH_STORAGE_KEY,
  clampCardImageWidth,
  readStoredCardImageWidth,
} from '@/lib/cardImageWidth';

export function useCardImageWidth() {
  const [cardImageWidth, setCardImageWidthState] = useState(() => readStoredCardImageWidth());

  useEffect(() => {
    window.localStorage.setItem(CARD_IMAGE_WIDTH_STORAGE_KEY, String(cardImageWidth));
  }, [cardImageWidth]);

  const setCardImageWidth = (width: number) => {
    setCardImageWidthState(clampCardImageWidth(width));
  };

  return { cardImageWidth, setCardImageWidth };
}
