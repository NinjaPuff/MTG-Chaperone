import { CardNameWithFlavorSubtitle } from '@/components/cardpool/CardNameWithFlavorSubtitle';
import { HoverTarget } from '@/components/cardpool/CardPreviewContext';
import { PoolCardImage } from '@/components/cardpool/PoolCardImage';
import { StagedRowQuantityPrefix } from '@/components/cardpool/StagedRowQuantityPrefix';
import { StagedRowRemoveButton } from '@/components/cardpool/StagedRowRemoveButton';

type StagedOwnerCardRowProps = {
  cachedCardId: string;
  name: string;
  flavorName?: string | null;
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
  flavorName,
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
        <HoverTarget scryfallId={cachedCardId} name={name} layout={null} imageUrl={imageUri}>
          <PoolCardImage
            name={name}
            scryfallId={cachedCardId}
            imageUris={{ normal: imageUri }}
            className="h-10 w-8 shrink-0 rounded border border-border object-cover"
            fallbackClassName="inline-flex h-10 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted px-1 text-center text-[9px] text-muted-foreground"
          />
        </HoverTarget>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <CardNameWithFlavorSubtitle name={name} flavorName={flavorName} nameClassName="truncate font-medium" />
          <p className="truncate text-xs text-muted-foreground">{phaseLabel}</p>
        </div>
        <StagedRowRemoveButton onClick={onRemove} disabled={applying} />
      </div>
    </div>
  );
}
