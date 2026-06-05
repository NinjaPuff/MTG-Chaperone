import { useEffect } from 'react';

export type DeckBuilderMenuAction = {
  label: string;
  onAction: () => void;
  disabled?: boolean;
};

export type DeckBuilderContextMenuProps = {
  cardName: string;
  pageX: number;
  pageY: number;
  actions: DeckBuilderMenuAction[];
  onDismiss: () => void;
};

export function DeckBuilderContextMenu({
  cardName,
  pageX,
  pageY,
  actions,
  onDismiss,
}: DeckBuilderContextMenuProps) {
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const menu = document.getElementById('deckbuilder-context-menu');
      if (menu && !menu.contains(target)) {
        onDismiss();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  return (
    <div
      id="deckbuilder-context-menu"
      className="absolute z-50 w-56 rounded-md border border-border bg-popover p-2 shadow-xl"
      style={{ left: Math.max(8, pageX), top: Math.max(8, pageY) }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="truncate px-2 py-1 text-sm font-semibold">{cardName}</p>
      <div className="mt-1 space-y-0.5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (!action.disabled) {
                action.onAction();
              }
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
