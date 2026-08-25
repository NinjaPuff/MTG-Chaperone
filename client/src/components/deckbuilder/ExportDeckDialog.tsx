import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { DeckBuilderCard } from '@/components/deckbuilder/types';
import { copyTextToClipboard } from '@/lib/inviteLink';
import {
  deckExportFilename,
  downloadDeckExport,
  formatDeckExport,
  type DeckExportFlavor,
} from '@/lib/deckExport';
import { useToast } from '@/context/ToastContext';

type ExportDeckDialogProps = {
  deckName: string;
  cards: DeckBuilderCard[];
  onClose: () => void;
};

export function ExportDeckDialog({ deckName, cards, onClose }: ExportDeckDialogProps) {
  const { showToast } = useToast();
  const [flavor, setFlavor] = useState<DeckExportFlavor>('moxfield');
  const text = useMemo(() => formatDeckExport(cards, flavor), [cards, flavor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyExport = async () => {
    try {
      await copyTextToClipboard(text);
      showToast({ message: 'Decklist copied', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to copy decklist' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close export dialog"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-deck-dialog-title"
        className="relative w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="export-deck-dialog-title" className="text-lg font-semibold">
            Export deck
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste this into Moxfield → Import, or Archidekt → Import list.
        </p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Export format">
          <button
            type="button"
            role="tab"
            aria-selected={flavor === 'moxfield'}
            className={`rounded border px-2 py-1 text-xs font-medium ${
              flavor === 'moxfield'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setFlavor('moxfield')}
          >
            Moxfield / Arena
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={flavor === 'archidekt'}
            className={`rounded border px-2 py-1 text-xs font-medium ${
              flavor === 'archidekt'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setFlavor('archidekt')}
          >
            Archidekt
          </button>
        </div>
        <pre
          data-testid="deck-export-text"
          className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs"
        >
          {text}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => void copyExport()}
          >
            Copy
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
            onClick={() => downloadDeckExport(deckExportFilename(deckName), text)}
          >
            Download .txt
          </button>
        </div>
      </div>
    </div>
  );
}
