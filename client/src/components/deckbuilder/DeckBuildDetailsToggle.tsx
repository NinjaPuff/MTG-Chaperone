type DeckBuildDetailsToggleProps = {
  expandedDeckMode: boolean;
  onChange: (expanded: boolean) => void;
  disabled?: boolean;
};

export function DeckBuildDetailsToggle({
  expandedDeckMode,
  onChange,
  disabled = false,
}: DeckBuildDetailsToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={!expandedDeckMode}
        disabled={disabled}
        className={`rounded border px-2 py-1 text-xs ${!expandedDeckMode ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
        onClick={() => onChange(false)}
      >
        Build
      </button>
      <button
        type="button"
        aria-pressed={expandedDeckMode}
        disabled={disabled}
        className={`rounded border px-2 py-1 text-xs ${expandedDeckMode ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
        onClick={() => onChange(true)}
      >
        Details
      </button>
    </div>
  );
}
