import { ReactNode, createContext, useContext, useMemo, useRef, useState } from 'react';

type PreviewState = {
  scryfallId: string;
  name: string;
  imageUrl: string | null;
  anchorRect: DOMRect;
  anchorPoint: { x: number; y: number };
} | null;

type CardPreviewContextValue = {
  preview: PreviewState;
  showPreview: (
    scryfallId: string,
    name: string,
    imageUrl: string | null,
    anchorRect: DOMRect,
    anchorPoint: { x: number; y: number },
  ) => void;
  hidePreview: () => void;
};

const CardPreviewContext = createContext<CardPreviewContextValue | null>(null);

type CardPreviewProviderProps = {
  children: ReactNode;
};

export function CardPreviewProvider({ children }: CardPreviewProviderProps) {
  const [preview, setPreview] = useState<PreviewState>(null);

  const value = useMemo<CardPreviewContextValue>(
    () => ({
      preview,
      showPreview: (scryfallId, name, imageUrl, anchorRect, anchorPoint) =>
        setPreview({
          scryfallId,
          name,
          imageUrl,
          anchorRect,
          anchorPoint,
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
  imageUrl: string | null;
  className?: string;
  element?: 'span' | 'div';
  children: ReactNode;
};

export function HoverTarget({ scryfallId, name, imageUrl, className, element = 'span', children }: HoverTargetProps) {
  const { showPreview, hidePreview } = useCardPreview();
  const hoverTimerRef = useRef<number | null>(null);
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
        clearHoverTimer();
        const target = event.currentTarget;
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        hoverTimerRef.current = window.setTimeout(() => {
          showPreview(scryfallId, name, imageUrl, target.getBoundingClientRect(), { x: mouseX, y: mouseY });
        }, 200);
      }}
      onMouseLeave={() => {
        clearHoverTimer();
        hidePreview();
      }}
    >
      {children}
    </Element>
  );
}
