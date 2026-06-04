import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type TouchAction = {
  label: string;
  onAction: () => void;
};

type PreviewState = {
  scryfallId: string;
  name: string;
  layout: string | null;
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

  const value = useMemo<CardPreviewContextValue>(
    () => ({
      preview,
      showPreview: (scryfallId, name, layout, imageUrl, anchorRect, anchorPoint, options) =>
        setPreview({
          scryfallId,
          name,
          layout,
          imageUrl,
          anchorRect,
          anchorPoint,
          touchActions: options?.touchActions ?? [],
          isTouchMode: options?.isTouchMode ?? false,
        }),
      hidePreview: () => setPreview(null),
    }),
    [preview],
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

type HoverTargetProps = {
  scryfallId: string;
  name: string;
  layout: string | null;
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
  imageUrl,
  touchActions,
  className,
  element = 'span',
  children,
}: HoverTargetProps) {
  const { preview, showPreview, hidePreview } = useCardPreview();
  const hoverTimerRef = useRef<number | null>(null);
  const isTouchPrimary = useMatchMedia('(hover: none)');
  const Element = element;

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

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
          showPreview(scryfallId, name, layout, imageUrl, target.getBoundingClientRect(), { x: mouseX, y: mouseY });
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
