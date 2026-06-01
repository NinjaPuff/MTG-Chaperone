import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

type StagedRowRemoveButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function StagedRowRemoveButton({ onClick, disabled }: StagedRowRemoveButtonProps) {
  return (
    <button
      type="button"
      aria-label="Remove"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        'bg-red-600 text-white shadow-sm',
        'hover:bg-red-700',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
