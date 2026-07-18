import { useEffect, useState } from 'react';
import { BasicLandAdder } from './BasicLandAdder';
import type { BasicLandSuggestion, SuggestBasicLandCard } from '@/lib/suggestBasicLands';

const LAND_ORDER: Array<keyof BasicLandSuggestion> = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];

type BasicLandZoneTab = 'main' | 'sideboard';

type BasicLandAdderPopupProps = {
  mainCounts: BasicLandSuggestion;
  sideboardCounts: BasicLandSuggestion;
  minDeckSize: number;
  mainDeckCards: SuggestBasicLandCard[];
  disabled?: boolean;
  onMainChange: (next: BasicLandSuggestion) => void;
  onSideboardChange: (next: BasicLandSuggestion) => void;
};

function sumBasicLands(counts: BasicLandSuggestion) {
  return LAND_ORDER.reduce((sum, land) => sum + counts[land], 0);
}

export function BasicLandAdderPopup({
  mainCounts,
  sideboardCounts,
  minDeckSize,
  mainDeckCards,
  disabled = false,
  onMainChange,
  onSideboardChange,
}: BasicLandAdderPopupProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BasicLandZoneTab>('main');
  const totalLands = sumBasicLands(mainCounts) + sumBasicLands(sideboardCounts);

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

  useEffect(() => {
    if (!open) {
      setActiveTab('main');
    }
  }, [open]);

  const label = totalLands > 0 ? `Basic Lands (${totalLands})` : 'Basic Lands';
  const activeCounts = activeTab === 'main' ? mainCounts : sideboardCounts;
  const activeOnChange = activeTab === 'main' ? onMainChange : onSideboardChange;

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
            <div className="mb-2 flex gap-1 rounded-md border border-border/70 p-0.5" role="tablist" aria-label="Basic land zones">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'main'}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                  activeTab === 'main' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setActiveTab('main')}
              >
                Main Deck
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sideboard'}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                  activeTab === 'sideboard' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setActiveTab('sideboard')}
              >
                Sideboard
              </button>
            </div>
            <BasicLandAdder
              counts={activeCounts}
              minDeckSize={minDeckSize}
              deckCards={mainDeckCards}
              onChange={activeOnChange}
              disabled={disabled}
              showHeader={false}
              showSuggestLands={activeTab === 'main'}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
