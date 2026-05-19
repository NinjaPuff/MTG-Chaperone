type StagedOwnerCardRowProps = {
  name: string;
  phaseLabel: string;
  imageUri: string | null;
  quantity: number;
  applying: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function StagedOwnerCardRow({
  name,
  phaseLabel,
  imageUri,
  quantity,
  applying,
  onQuantityChange,
  onRemove,
}: StagedOwnerCardRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1.5 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        {imageUri ? (
          <img src={imageUri} alt={name} className="h-10 w-8 shrink-0 rounded border border-border object-cover" />
        ) : null}
        <span className="min-w-0 truncate">
          <span className="font-medium">Add</span> - {name} ({phaseLabel})
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(event) => onQuantityChange(Math.max(1, Number(event.target.value) || 1))}
          disabled={applying}
          className="w-14 rounded border border-border bg-background px-1 py-0.5 text-xs"
        />
        <button
          type="button"
          className="rounded border border-border px-1.5 py-0.5 text-[11px] font-medium hover:bg-muted"
          onClick={onRemove}
          disabled={applying}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
