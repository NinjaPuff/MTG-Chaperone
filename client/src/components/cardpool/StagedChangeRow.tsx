import { HoverTarget } from '@/components/cardpool/CardPreviewContext';

type StagedChangeRowProps = {
  cachedCardId: string;
  label: string;
  imageUri: string | null;
  imageAlt: string;
  applying: boolean;
  onRemove: () => void;
};

export function StagedChangeRow({
  cachedCardId,
  label,
  imageUri,
  imageAlt,
  applying,
  onRemove,
}: StagedChangeRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1.5 text-xs">
      <HoverTarget scryfallId={cachedCardId} name={imageAlt} imageUrl={imageUri}>
        <div className="flex min-w-0 items-center gap-2">
          {imageUri ? (
            <img src={imageUri} alt={imageAlt} className="h-10 w-8 shrink-0 rounded border border-border object-cover" />
          ) : null}
          <span className="min-w-0 truncate">{label}</span>
        </div>
      </HoverTarget>
      <button
        type="button"
        className="rounded border border-border px-1.5 py-0.5 text-[11px] font-medium hover:bg-muted"
        onClick={onRemove}
        disabled={applying}
      >
        Remove
      </button>
    </div>
  );
}
