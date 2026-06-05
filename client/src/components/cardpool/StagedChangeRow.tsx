import { HoverTarget } from '@/components/cardpool/CardPreviewContext';
import { StagedRowQuantityPrefix } from '@/components/cardpool/StagedRowQuantityPrefix';
import { StagedRowRemoveButton } from '@/components/cardpool/StagedRowRemoveButton';

export type StagedChangeAction = 'add' | 'remove_one' | 'remove_all';

type StagedChangeRowProps = {
  cachedCardId: string;
  action: StagedChangeAction;
  quantity?: number;
  name: string;
  phaseLabel: string;
  imageUri: string | null;
  applying: boolean;
  onRemove: () => void;
};

function actionLabel(action: StagedChangeAction) {
  if (action === 'add') {
    return 'Add';
  }
  if (action === 'remove_one') {
    return 'Remove';
  }
  return 'Remove all';
}

function badgeValue(action: StagedChangeAction, quantity?: number) {
  if (action === 'remove_all') {
    return 'All';
  }
  if (action === 'add') {
    return `+${quantity ?? 1}`;
  }
  return `−${quantity ?? 1}`;
}

export function StagedChangeRow({
  cachedCardId,
  action,
  quantity,
  name,
  phaseLabel,
  imageUri,
  applying,
  onRemove,
}: StagedChangeRowProps) {
  const label = `${actionLabel(action)} · ${name} · ${phaseLabel}`;

  return (
    <div className="flex items-center gap-2 rounded border border-border/60 px-2 py-1.5 text-xs">
      <StagedRowQuantityPrefix mode="badge" value={badgeValue(action, quantity)} />
      {imageUri ? (
        <HoverTarget scryfallId={cachedCardId} name={name} layout={null} imageUrl={imageUri}>
          <img
            src={imageUri}
            alt={name}
            className="h-10 w-8 shrink-0 rounded border border-border object-cover"
          />
        </HoverTarget>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 truncate">{label}</span>
        <StagedRowRemoveButton onClick={onRemove} disabled={applying} />
      </div>
    </div>
  );
}
