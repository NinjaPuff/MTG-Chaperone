import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ViewToolbar } from '../../../components/cardpool/ViewToolbar';
import { CARD_TYPE_FILTERS, COLOR_FILTERS } from '../../../lib/cardPoolFilters';

type ViewToolbarProps = Parameters<typeof ViewToolbar>[0];

function renderViewToolbar(overrides: Partial<ViewToolbarProps> = {}) {
  const handlers = {
    onToggleColorFilter: vi.fn(),
    onToggleTypeFilter: vi.fn(),
    onToggleShowBasicLands: vi.fn(),
    onToggleShowRestrictedCards: vi.fn(),
    onResetFilters: vi.fn(),
    onChange: vi.fn(),
  };

  const baseProps: ViewToolbarProps = {
    viewMode: 'list',
    sortKey: 'name',
    groupMode: 'flat',
    totalCards: 10,
    selectedColorFilters: [...COLOR_FILTERS],
    selectedTypeFilters: [...CARD_TYPE_FILTERS],
    showBasicLands: true,
    showRestrictedCards: true,
    onToggleColorFilter: handlers.onToggleColorFilter,
    onToggleTypeFilter: handlers.onToggleTypeFilter,
    onToggleShowBasicLands: handlers.onToggleShowBasicLands,
    onResetFilters: handlers.onResetFilters,
    onChange: handlers.onChange,
    ...overrides,
  };

  const view = render(<ViewToolbar {...baseProps} />);

  return {
    ...handlers,
    rerender: (nextOverrides: Partial<ViewToolbarProps> = {}) => {
      view.rerender(<ViewToolbar {...baseProps} {...nextOverrides} />);
    },
  };
}

function openFiltersDropdown() {
  fireEvent.click(screen.getByText(/Filters \(\d+\/\d+\)/));
}

function openDisplaySettingsDropdown() {
  fireEvent.click(screen.getByText(/Display Settings/));
}

describe('ViewToolbar', () => {
  it('calls onToggleColorFilter when a color checkbox is clicked', () => {
    const { onToggleColorFilter } = renderViewToolbar();
    openFiltersDropdown();

    fireEvent.click(screen.getByRole('checkbox', { name: 'W' }));

    expect(onToggleColorFilter).toHaveBeenCalledTimes(1);
    expect(onToggleColorFilter).toHaveBeenCalledWith('W');
  });

  it('toggles Show Basic Lands through onToggleShowBasicLands', () => {
    const { onToggleShowBasicLands, rerender } = renderViewToolbar();
    openDisplaySettingsDropdown();

    const checkbox = screen.getByRole('checkbox', { name: 'Show Basic Lands' });
    fireEvent.click(checkbox);
    expect(onToggleShowBasicLands).toHaveBeenCalledWith(false);

    rerender({ showBasicLands: false });
    openDisplaySettingsDropdown();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Basic Lands' }));
    expect(onToggleShowBasicLands).toHaveBeenCalledWith(true);
    expect(onToggleShowBasicLands).toHaveBeenCalledTimes(2);
  });

  it('toggles acquisition group through onChange', () => {
    const { onChange, rerender } = renderViewToolbar();
    openDisplaySettingsDropdown();

    const checkbox = screen.getByRole('checkbox', { name: 'Organize by Card Acquisition Group' });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ groupMode: 'phase' });

    rerender({ groupMode: 'phase' });
    openDisplaySettingsDropdown();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Organize by Card Acquisition Group' }));
    expect(onChange).toHaveBeenCalledWith({ groupMode: 'flat' });
  });

  it('hides Clear Filters when defaults are selected', () => {
    renderViewToolbar();
    openFiltersDropdown();

    expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();
  });

  it('shows Clear Filters and calls onResetFilters when filters differ from defaults', () => {
    const { onResetFilters } = renderViewToolbar({ selectedColorFilters: ['W'] });
    openFiltersDropdown();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleShowRestrictedCards when deckbuilder toggle is enabled', () => {
    const onToggleShowRestrictedCards = vi.fn();
    renderViewToolbar({
      allowRestrictedFilterToggle: true,
      onToggleShowRestrictedCards,
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Restricted' }));
    expect(onToggleShowRestrictedCards).toHaveBeenCalledTimes(1);
    expect(onToggleShowRestrictedCards).toHaveBeenCalledWith(false);
  });

  it('unchecks a selected color filter with real state', () => {
    function StatefulToolbar() {
      const [selectedColorFilters, setSelectedColorFilters] = useState<string[]>([...COLOR_FILTERS]);

      return (
        <ViewToolbar
          viewMode="list"
          sortKey="name"
          groupMode="flat"
          totalCards={10}
          selectedColorFilters={selectedColorFilters}
          selectedTypeFilters={[...CARD_TYPE_FILTERS]}
          showBasicLands={true}
          onToggleColorFilter={(value) =>
            setSelectedColorFilters((prev) =>
              prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value],
            )
          }
          onToggleTypeFilter={vi.fn()}
          onToggleShowBasicLands={vi.fn()}
          onResetFilters={vi.fn()}
          onChange={vi.fn()}
        />
      );
    }

    render(<StatefulToolbar />);
    openFiltersDropdown();

    const whiteCheckbox = screen.getByRole('checkbox', { name: 'W' });
    expect(whiteCheckbox).toBeChecked();
    fireEvent.click(whiteCheckbox);
    expect(whiteCheckbox).not.toBeChecked();
    expect(screen.getByText(/Filters \(13\/14\)/)).toBeInTheDocument();
  });
});
