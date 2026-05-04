import { useDragContext } from './DragContext';

type DragGhostProps = {
  label?: string;
  blocked?: boolean;
};

export function DragGhost({ label, blocked = false }: DragGhostProps) {
  const { dragState } = useDragContext();
  if (!dragState.card) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2"
      style={{ left: dragState.cursorX, top: dragState.cursorY }}
    >
      <div className={`rounded-md border bg-card/90 p-1 shadow-lg ${blocked ? 'border-destructive' : 'border-primary/60'}`}>
        {dragState.card.imageUrl ? (
          <img src={dragState.card.imageUrl} alt={dragState.card.name} className="h-24 w-16 rounded object-cover opacity-80" />
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded bg-muted px-1 text-center text-[10px] leading-tight">
            {dragState.card.name}
          </div>
        )}
      </div>
      <div className={`mt-1 rounded px-2 py-1 text-[10px] font-semibold ${blocked ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>
        {blocked ? 'Not allowed' : label ?? 'Drop to add'}
      </div>
    </div>
  );
}

