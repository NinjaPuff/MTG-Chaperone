import type { ToastItem } from '@/context/ToastContext';
import { cn } from '@/lib/utils';

type ToasterProps = {
  toasts: ToastItem[];
};

export function Toaster({ toasts }: ToasterProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-label={toast.message}
          className={cn(
            'toast-enter pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-lg',
            toast.variant === 'success'
              ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground'
              : 'border-border bg-card text-card-foreground',
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
