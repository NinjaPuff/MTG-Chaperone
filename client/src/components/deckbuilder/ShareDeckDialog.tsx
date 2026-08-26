import { X } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/inviteLink';
import { isOverDiscordMessageLimit } from '@/lib/shareLink';
import { useToast } from '@/context/ToastContext';

type ShareDeckDialogProps = {
  url: string;
  onClose: () => void;
};

export function ShareDeckDialog({ url, onClose }: ShareDeckDialogProps) {
  const { showToast } = useToast();
  const overDiscordLimit = isOverDiscordMessageLimit(url);

  const copyLink = async () => {
    try {
      await copyTextToClipboard(url);
      showToast({ message: 'Share link copied', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to copy share link' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close share dialog"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-deck-dialog-title"
        className="relative w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-deck-dialog-title" className="text-lg font-semibold">
            Share decklist
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
          Anyone with the link can see this list. It’s a snapshot — later edits need a new link. It
          won’t show up on /decks.
        </p>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
            {url}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => void copyLink()}
          >
            Copy
          </button>
        </div>
        {overDiscordLimit ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            This link may be too long to paste into Discord.
          </p>
        ) : null}
      </div>
    </div>
  );
}
