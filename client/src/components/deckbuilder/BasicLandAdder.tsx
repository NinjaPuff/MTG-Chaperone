import { suggestBasicLands, type BasicLandSuggestion, type SuggestBasicLandCard } from '@/lib/suggestBasicLands';
import { useConfirm } from '@/context/ConfirmContext';

const LAND_ORDER: Array<keyof BasicLandSuggestion> = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];

type BasicLandAdderProps = {
  counts: BasicLandSuggestion;
  minDeckSize: number;
  deckCards: SuggestBasicLandCard[];
  disabled?: boolean;
  showHeader?: boolean;
  showSuggestLands?: boolean;
  onChange: (next: BasicLandSuggestion) => void;
};

export function BasicLandAdder({
  counts,
  minDeckSize,
  deckCards,
  disabled = false,
  showHeader = true,
  showSuggestLands = true,
  onChange,
}: BasicLandAdderProps) {
  const { confirm } = useConfirm();

  const updateCount = (land: keyof BasicLandSuggestion, delta: number) => {
    const next = {
      ...counts,
      [land]: Math.max(0, counts[land] + delta),
    };
    onChange(next);
  };

  const applySuggestion = async () => {
    const suggested = suggestBasicLands(deckCards, minDeckSize);
    const hasExisting = LAND_ORDER.some((land) => counts[land] > 0);
    if (hasExisting) {
      const confirmed = await confirm({
        title: 'Replace basic lands',
        message: 'Replace current basic lands with suggested values?',
        confirmLabel: 'Replace',
        variant: 'destructive',
      });
      if (!confirmed) {
        return;
      }
    }
    onChange(suggested);
  };

  return (
    <div className={showHeader ? 'space-y-2 rounded-md border border-border/70 bg-card p-3' : 'space-y-2'}>
      {showSuggestLands ? (
        showHeader ? (
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic Lands</h3>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
              onClick={() => void applySuggestion()}
              disabled={disabled}
            >
              Suggest Lands
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
              onClick={() => void applySuggestion()}
              disabled={disabled}
            >
              Suggest Lands
            </button>
          </div>
        )
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {LAND_ORDER.map((land) => (
          <div key={land} className="flex items-center justify-between rounded border border-border/50 px-2 py-1">
            <span className="text-xs">{land}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="h-6 w-6 rounded border border-border text-xs hover:bg-muted disabled:opacity-50"
                onClick={() => updateCount(land, -1)}
                disabled={disabled || counts[land] < 1}
              >
                -
              </button>
              <span className="w-5 text-center text-xs">{counts[land]}</span>
              <button
                type="button"
                className="h-6 w-6 rounded border border-border text-xs hover:bg-muted disabled:opacity-50"
                onClick={() => updateCount(land, 1)}
                disabled={disabled}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

