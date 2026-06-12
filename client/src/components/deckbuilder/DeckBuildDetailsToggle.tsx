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
    <div className="flex shrink-0 items-center gap-2" data-testid="deck-view-toggle">
      <span className="text-xs text-muted-foreground">View</span>
      <div className="inline-flex rounded-md bg-muted p-0.5" role="group" aria-label="Deck view">
        <button
          type="button"
          aria-pressed={!expandedDeckMode}
          disabled={disabled}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            !expandedDeckMode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange(false)}
        >
          Build
        </button>
        <button
          type="button"
          aria-pressed={expandedDeckMode}
          disabled={disabled}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            expandedDeckMode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange(true)}
        >
          Details
        </button>
      </div>
    </div>
  );
}
