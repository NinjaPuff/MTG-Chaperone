import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

export type DragSourceZone = 'pool' | 'main' | 'sideboard';

export type DragCardPayload = {
  cachedCardId: string;
  name: string;
  imageUrl: string | null;
  sourceZone: DragSourceZone;
  sourceDeckId?: string;
};

type DragState = {
  card: DragCardPayload | null;
  cursorX: number;
  cursorY: number;
};

type DragContextValue = {
  dragState: DragState;
  beginDrag: (card: DragCardPayload, x: number, y: number) => void;
  updateCursor: (x: number, y: number) => void;
  clearDrag: () => void;
};

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({ children }: PropsWithChildren) {
  const [dragState, setDragState] = useState<DragState>({
    card: null,
    cursorX: 0,
    cursorY: 0,
  });

  const value = useMemo<DragContextValue>(
    () => ({
      dragState,
      beginDrag: (card, x, y) => setDragState({ card, cursorX: x, cursorY: y }),
      updateCursor: (x, y) =>
        setDragState((prev) => ({
          ...prev,
          cursorX: x,
          cursorY: y,
        })),
      clearDrag: () =>
        setDragState({
          card: null,
          cursorX: 0,
          cursorY: 0,
        }),
    }),
    [dragState],
  );

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function useDragContext() {
  const value = useContext(DragContext);
  if (!value) {
    throw new Error('useDragContext must be used inside DragProvider');
  }
  return value;
}

