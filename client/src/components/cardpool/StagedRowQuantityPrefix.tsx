import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

type StagedRowQuantityPrefixProps =
  | { mode: 'editable'; value: number; onChange: (quantity: number) => void; disabled?: boolean }
  | { mode: 'badge'; value: string };

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

function clampQuantity(quantity: number) {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, quantity));
}

const prefixClassName =
  'flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-xs font-medium tabular-nums text-foreground';

const stepperButtonClassName = cn(
  'flex flex-1 items-center justify-center text-muted-foreground',
  'hover:bg-muted hover:text-foreground',
  'disabled:pointer-events-none disabled:opacity-40',
);

export function StagedRowQuantityPrefix(props: StagedRowQuantityPrefixProps) {
  if (props.mode === 'badge') {
    return <span className={cn(prefixClassName, 'w-14')}>{props.value}</span>;
  }

  const { value, onChange, disabled } = props;

  return (
    <div
      className={cn(
        prefixClassName,
        'w-[4.25rem] overflow-hidden p-0',
        'focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/30',
        disabled && 'opacity-50',
      )}
    >
      <input
        type="number"
        min={MIN_QUANTITY}
        max={MAX_QUANTITY}
        value={value}
        onChange={(event) => onChange(clampQuantity(Number(event.target.value) || MIN_QUANTITY))}
        disabled={disabled}
        aria-label="Quantity"
        className={cn(
          'h-full w-9 min-w-0 border-0 bg-transparent px-0.5 text-center',
          '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          'focus:outline-none disabled:cursor-not-allowed',
        )}
      />
      <div className="flex h-full w-5 flex-col border-l border-border/80">
        <button
          type="button"
          className={stepperButtonClassName}
          aria-label="Increase quantity"
          disabled={disabled || value >= MAX_QUANTITY}
          onClick={() => onChange(clampQuantity(value + 1))}
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className={stepperButtonClassName}
          aria-label="Decrease quantity"
          disabled={disabled || value <= MIN_QUANTITY}
          onClick={() => onChange(clampQuantity(value - 1))}
        >
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
