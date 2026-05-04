import type { ReactNode } from 'react';
import type { GroupMode, SortKey, StacksOrganizeBy, ViewMode } from './types';
import { cn } from '@/lib/utils';

type ViewToolbarProps = {
  viewMode: ViewMode;
  sortKey: SortKey;
  groupMode: GroupMode;
  stacksOrganizeBy?: StacksOrganizeBy;
  totalCards: number;
  disableVisualViews?: boolean;
  selectedColorFilters: string[];
  selectedTypeFilters: string[];
  showBasicLands: boolean;
  showRestrictedCards?: boolean;
  allowRestrictedFilterToggle?: boolean;
  onToggleColorFilter: (value: string) => void;
  onToggleTypeFilter: (value: string) => void;
  onToggleShowBasicLands: (value: boolean) => void;
  onToggleShowRestrictedCards?: (value: boolean) => void;
  onResetFilters: () => void;
  onChange: (
    next: Partial<{ viewMode: ViewMode; sortKey: SortKey; groupMode: GroupMode; stacksOrganizeBy: StacksOrganizeBy }>,
  ) => void;
};

const VIEW_OPTIONS: Array<{ id: ViewMode; label: string; icon: ReactNode }> = [
  {
    id: 'list',
    label: 'List',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'grid',
    label: 'Grid',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'stacks',
    label: 'Stacks',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path d="M5 16l7-4 7 4-7 4-7-4zm0-4 7-4 7 4m-14 0 7 4 7-4" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'curve',
    label: 'Curve',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path d="M5 19V9m7 10V5m7 14v-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const BASE_SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'name', label: 'Name' },
  { id: 'cmc', label: 'Mana Value' },
  { id: 'color', label: 'Color' },
  { id: 'type', label: 'Type' },
  { id: 'rarity', label: 'Rarity' },
];

const STACKS_SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'quantity', label: 'Copies (High to Low)' },
  { id: 'set', label: 'Set Code' },
];
const COLOR_FILTERS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
const TYPE_FILTERS = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Other'] as const;

type CombinedFilterDropdownProps = {
  selectedColorFilters: string[];
  selectedTypeFilters: string[];
  onToggleColorFilter: (value: string) => void;
  onToggleTypeFilter: (value: string) => void;
  onResetFilters: () => void;
};

type ProTweaksDropdownProps = {
  groupMode: GroupMode;
  showBasicLands: boolean;
  onChangeGroupMode: (isPhase: boolean) => void;
  onToggleShowBasicLands: (value: boolean) => void;
};

function CombinedFilterDropdown({
  selectedColorFilters,
  selectedTypeFilters,
  onToggleColorFilter,
  onToggleTypeFilter,
  onResetFilters,
}: CombinedFilterDropdownProps) {
  const totalSelected = selectedColorFilters.length + selectedTypeFilters.length;
  const totalFilters = COLOR_FILTERS.length + TYPE_FILTERS.length;
  const filtersChanged = selectedColorFilters.length !== COLOR_FILTERS.length || selectedTypeFilters.length !== TYPE_FILTERS.length;

  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
        Filters ({totalSelected}/{totalFilters})
      </summary>
      <div className="absolute z-20 mt-1 min-w-[26rem] rounded-md border border-border bg-card p-3 shadow-lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Color</p>
            <div className="space-y-1">
              {COLOR_FILTERS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedColorFilters.includes(option)}
                    onChange={() => onToggleColorFilter(option)}
                    className="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Type</p>
            <div className="space-y-1">
              {TYPE_FILTERS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedTypeFilters.includes(option)}
                    onChange={() => onToggleTypeFilter(option)}
                    className="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>
        {filtersChanged ? (
          <div className="mt-3 border-t border-border pt-2">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              onClick={onResetFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ProTweaksDropdown({
  groupMode,
  showBasicLands,
  onChangeGroupMode,
  onToggleShowBasicLands,
}: ProTweaksDropdownProps) {
  const changed = groupMode === 'phase' || !showBasicLands;

  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
        Display Settings{changed ? ' *' : ''}
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-[19rem] rounded-md border border-border bg-card p-3 shadow-lg">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Specific View Settings</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={groupMode === 'phase'}
              onChange={(event) => onChangeGroupMode(event.target.checked)}
              className="h-4 w-4 rounded border-border bg-background accent-primary"
            />
            Organize by Card Acquisition Group
          </label>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={showBasicLands}
              onChange={(event) => onToggleShowBasicLands(event.target.checked)}
              className="h-4 w-4 rounded border-border bg-background accent-primary"
            />
            Show Basic Lands
          </label>
        </div>
      </div>
    </details>
  );
}

export function ViewToolbar({
  viewMode,
  sortKey,
  groupMode,
  stacksOrganizeBy = 'type',
  totalCards,
  disableVisualViews = false,
  selectedColorFilters,
  selectedTypeFilters,
  showBasicLands,
  showRestrictedCards = true,
  allowRestrictedFilterToggle = false,
  onToggleColorFilter,
  onToggleTypeFilter,
  onToggleShowBasicLands,
  onToggleShowRestrictedCards,
  onResetFilters,
  onChange,
}: ViewToolbarProps) {
  const sortOptions = viewMode === 'stacks' ? [...BASE_SORT_OPTIONS, ...STACKS_SORT_OPTIONS] : BASE_SORT_OPTIONS;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1">
        {VIEW_OPTIONS.map((view) => {
          const isDisabled = disableVisualViews && view.id !== 'list';
          return (
          <button
            key={view.id}
            type="button"
            title={view.label}
            disabled={isDisabled}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted',
              viewMode === view.id && 'border-primary bg-primary/10 text-foreground',
              isDisabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
            )}
            onClick={() => onChange({ viewMode: view.id })}
          >
            {view.icon}
          </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort</span>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={sortKey}
          onChange={(event) => onChange({ sortKey: event.target.value as SortKey })}
        >
          {sortOptions.map((sort) => (
            <option key={sort.id} value={sort.id}>
              {sort.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Group</span>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={stacksOrganizeBy}
          onChange={(event) => onChange({ stacksOrganizeBy: event.target.value as StacksOrganizeBy })}
        >
          <option value="type">Card Type</option>
          <option value="color">Color</option>
          <option value="cmc">Mana Value</option>
          <option value="creature_split">Creatures / Non-Creatures</option>
        </select>
      </label>

      <CombinedFilterDropdown
        selectedColorFilters={selectedColorFilters}
        selectedTypeFilters={selectedTypeFilters}
        onToggleColorFilter={onToggleColorFilter}
        onToggleTypeFilter={onToggleTypeFilter}
        onResetFilters={onResetFilters}
      />
      <ProTweaksDropdown
        groupMode={groupMode}
        showBasicLands={showBasicLands}
        onChangeGroupMode={(isPhase) => onChange({ groupMode: isPhase ? 'phase' : 'flat' })}
        onToggleShowBasicLands={onToggleShowBasicLands}
      />
      {allowRestrictedFilterToggle ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showRestrictedCards}
            onChange={(event) => onToggleShowRestrictedCards?.(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
          />
          Show Restricted
        </label>
      ) : null}

      <span className="ml-auto text-sm text-muted-foreground">{totalCards} cards</span>
      {disableVisualViews ? (
        <span className="w-full text-xs text-amber-600">Visual modes are disabled for large pools to keep the page responsive.</span>
      ) : null}
    </div>
  );
}
