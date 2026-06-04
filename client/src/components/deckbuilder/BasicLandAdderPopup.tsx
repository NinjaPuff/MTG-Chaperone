import { useEffect, useState } from 'react';
import { BasicLandAdder } from './BasicLandAdder';
import type { BasicLandSuggestion, SuggestBasicLandCard } from '@/lib/suggestBasicLands';

const LAND_ORDER: Array<keyof BasicLandSuggestion> = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];

type BasicLandAdderPopupProps = {
  counts: BasicLandSuggestion;
  minDeckSize: number;
  deckCards: SuggestBasicLandCard[];
  disabled?: boolean;
  onChange: (next: BasicLandSuggestion) => void;
};

function sumBasicLands(counts: BasicLandSuggestion) {
  return LAND_ORDER.reduce((sum, land) => sum + counts[land], 0);
}

export function BasicLandAdderPopup({
  counts,
  minDeckSize,
  deckCards,
  disabled = false,
  onChange,
}: BasicLandAdderPopupProps) {
  const [open, setOpen] = useState(false);
  const totalLands = sumBasicLands(counts);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const label = totalLands > 0 ? `Basic Lands (${totalLands})` : 'Basic Lands';

  return (
    <>
      <button
        type="button"
        className="w-full rounded-md border border-border/70 bg-card px-2 py-1.5 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close basic lands dialog"
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="basic-lands-dialog-title"
            className="relative w-full max-w-sm rounded-lg border border-border bg-card p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="basic-lands-dialog-title" className="text-sm font-semibold">
                Basic Lands
              </h2>
              <button
                type="button"
                className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <BasicLandAdder
              counts={counts}
              minDeckSize={minDeckSize}
              deckCards={deckCards}
              onChange={onChange}
              disabled={disabled}
              showHeader={false}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
