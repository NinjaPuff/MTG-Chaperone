import { HoverTarget } from '@/components/cardpool/CardPreviewContext';
import { StagedRowQuantityPrefix } from '@/components/cardpool/StagedRowQuantityPrefix';
import { StagedRowRemoveButton } from '@/components/cardpool/StagedRowRemoveButton';

type StagedOwnerCardRowProps = {
  cachedCardId: string;
  name: string;
  phaseLabel: string;
  imageUri: string | null;
  quantity: number;
  applying: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function StagedOwnerCardRow({
  cachedCardId,
  name,
  phaseLabel,
  imageUri,
  quantity,
  applying,
  onQuantityChange,
  onRemove,
}: StagedOwnerCardRowProps) {
  return (
    <div className="flex items-center gap-2 rounded border border-border/60 px-2 py-1.5 text-xs">
      <StagedRowQuantityPrefix
        mode="editable"
        value={quantity}
        onChange={onQuantityChange}
        disabled={applying}
      />
      {imageUri ? (
        <HoverTarget scryfallId={cachedCardId} name={name} imageUrl={imageUri}>
          <img
            src={imageUri}
            alt={name}
            className="h-10 w-8 shrink-0 rounded border border-border object-cover"
          />
        </HoverTarget>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 truncate font-medium">
          {name} · {phaseLabel}
        </span>
        <StagedRowRemoveButton onClick={onRemove} disabled={applying} />
      </div>
    </div>
  );
}
