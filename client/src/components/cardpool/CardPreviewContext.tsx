import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type TouchAction = {
  label: string;
  onAction: () => void;
};

type PreviewState = {
  scryfallId: string;
  name: string;
  layout: string | null;
  typeLine: string | null;
  imageUrl: string | null;
  anchorRect: DOMRect;
  anchorPoint: { x: number; y: number };
  touchActions: TouchAction[];
  isTouchMode: boolean;
} | null;

type ShowPreviewOptions = {
  touchActions?: TouchAction[];
  isTouchMode?: boolean;
};

type CardPreviewContextValue = {
  preview: PreviewState;
  showPreview: (
    scryfallId: string,
    name: string,
    layout: string | null,
    typeLine: string | null,
    imageUrl: string | null,
    anchorRect: DOMRect,
    anchorPoint: { x: number; y: number },
    options?: ShowPreviewOptions,
  ) => void;
  hidePreview: () => void;
};

const CardPreviewContext = createContext<CardPreviewContextValue | null>(null);

export function deviceHasHover() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(hover: hover)').matches;
}

export function deviceIsTouchPrimary() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(hover: none)').matches;
}

function useMatchMedia(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

type CardPreviewProviderProps = {
  children: ReactNode;
};

export function CardPreviewProvider({ children }: CardPreviewProviderProps) {
  const [preview, setPreview] = useState<PreviewState>(null);
  const showPreview = useCallback<CardPreviewContextValue['showPreview']>(
    (scryfallId, name, layout, typeLine, imageUrl, anchorRect, anchorPoint, options) =>
      setPreview({
        scryfallId,
        name,
        layout,
        typeLine,
        imageUrl,
        anchorRect,
        anchorPoint,
        touchActions: options?.touchActions ?? [],
        isTouchMode: options?.isTouchMode ?? false,
      }),
    [],
  );
  const hidePreview = useCallback(() => setPreview(null), []);

  const value = useMemo<CardPreviewContextValue>(
    () => ({
      preview,
      showPreview,
      hidePreview,
    }),
    [hidePreview, preview, showPreview],
  );

  return (
    <CardPreviewContext.Provider value={value}>
      {children}
    </CardPreviewContext.Provider>
  );
}

export function useCardPreview() {
  const value = useContext(CardPreviewContext);
  if (!value) {
    throw new Error('useCardPreview must be used inside CardPreviewProvider');
  }
  return value;
}

export function CardPreviewNavigationReset() {
  const { pathname } = useLocation();
  const { hidePreview } = useCardPreview();

  useEffect(() => {
    hidePreview();
  }, [hidePreview, pathname]);

  return null;
}

type HoverTargetProps = {
  scryfallId: string;
  name: string;
  layout: string | null;
  typeLine?: string | null;
  imageUrl: string | null;
  touchActions?: TouchAction[];
  className?: string;
  element?: 'span' | 'div';
  children: ReactNode;
};

export function HoverTarget({
  scryfallId,
  name,
  layout,
  typeLine = null,
  imageUrl,
  touchActions,
  className,
  element = 'span',
  children,
}: HoverTargetProps) {
  const { preview, showPreview, hidePreview } = useCardPreview();
  const hoverTimerRef = useRef<number | null>(null);
  const previewOwnedRef = useRef(false);
  const isTouchPrimary = useMatchMedia('(hover: none)');
  const Element = element;

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  useEffect(() => {
    previewOwnedRef.current = preview?.scryfallId === scryfallId;
  }, [preview, scryfallId]);

  useEffect(
    () => () => {
      clearHoverTimer();
      if (previewOwnedRef.current) {
        hidePreview();
      }
    },
    [hidePreview],
  );

  return (
    <Element
      className={className}
      onMouseEnter={(event) => {
        if (isTouchPrimary) {
          return;
        }
        clearHoverTimer();
        const target = event.currentTarget;
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        hoverTimerRef.current = window.setTimeout(() => {
          showPreview(scryfallId, name, layout, typeLine, imageUrl, target.getBoundingClientRect(), { x: mouseX, y: mouseY });
        }, 200);
      }}
      onMouseLeave={() => {
        if (isTouchPrimary) {
          return;
        }
        clearHoverTimer();
        hidePreview();
      }}
      onClick={(event) => {
        if (!isTouchPrimary) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
        if (preview?.scryfallId === scryfallId && preview.isTouchMode) {
          hidePreview();
          return;
        }
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        showPreview(
          scryfallId,
          name,
          layout,
          typeLine,
          imageUrl,
          rect,
          { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          { touchActions: touchActions ?? [], isTouchMode: true },
        );
      }}
    >
      {children}
    </Element>
  );
}
