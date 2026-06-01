import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

type UseSearchResultsKeyboardOptions = {
  resultCount: number;
  onSelectIndex: (index: number) => void;
};

export function useSearchResultsKeyboard({ resultCount, onSelectIndex }: UseSearchResultsKeyboardOptions) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeIndexRef = useRef<number | null>(null);

  const setHighlight = useCallback((index: number | null) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    if (resultCount === 0) {
      setHighlight(null);
      return;
    }

    const current = activeIndexRef.current;
    if (current !== null) {
      setHighlight(Math.min(current, resultCount - 1));
    }
  }, [resultCount, setHighlight]);

  const resetHighlight = useCallback(() => {
    setHighlight(null);
  }, [setHighlight]);

  const handleResultMouseEnter = useCallback(
    (index: number) => {
      setHighlight(index);
    },
    [setHighlight],
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        if (resultCount === 0) {
          return;
        }
        event.preventDefault();
        const current = activeIndexRef.current;
        const next = current === null ? 0 : Math.min(current + 1, resultCount - 1);
        setHighlight(next);
        return;
      }

      if (event.key === 'ArrowUp') {
        const current = activeIndexRef.current;
        if (current === null) {
          return;
        }
        event.preventDefault();
        setHighlight(Math.max(0, current - 1));
        return;
      }

      if (event.key === 'Enter') {
        const current = activeIndexRef.current;
        if (current === null) {
          return;
        }
        event.preventDefault();
        onSelectIndex(current);
        setHighlight(null);
        return;
      }

      if (event.key === 'Escape') {
        if (activeIndexRef.current === null) {
          return;
        }
        event.preventDefault();
        setHighlight(null);
      }
    },
    [onSelectIndex, resultCount, setHighlight],
  );

  return {
    activeIndex,
    handleInputKeyDown,
    handleResultMouseEnter,
    resetHighlight,
  };
}
