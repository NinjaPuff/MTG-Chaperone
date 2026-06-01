import { createRef } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardPoolSearchPanel } from '../../../components/cardpool/CardPoolSearchPanel';
import { threeSearchResults } from '../../helpers/cardPoolSearchFixtures';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

function renderPanel(overrides?: Partial<Parameters<typeof CardPoolSearchPanel>[0]>) {
  const inputRef = createRef<HTMLInputElement>();
  const onStageCard = vi.fn();
  const onSearchQueryChange = vi.fn();

  renderWithAppProviders(
    <CardPoolSearchPanel
      phaseLabel="Pack 1"
      phaseOptions={['Pack 1', 'Pack 2']}
      onPhaseLabelChange={vi.fn()}
      searchQuery="bolt"
      onSearchQueryChange={onSearchQueryChange}
      searchResults={threeSearchResults}
      searching={false}
      onStageCard={onStageCard}
      inputRef={inputRef}
      {...overrides}
    />,
  );

  const searchInput = screen.getByRole('combobox', { name: 'Search cards' }) as HTMLInputElement;
  searchInput.focus();
  if (inputRef.current === null) {
    Object.defineProperty(inputRef, 'current', { value: searchInput, writable: true });
  }

  return { inputRef, onStageCard, onSearchQueryChange, searchInput };
}

function getResultOptions() {
  const listbox = screen.getByRole('listbox', { name: 'Search results' });
  return within(listbox).getAllByRole('option');
}

describe('CardPoolSearchPanel', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders search results when searchResults is non-empty', () => {
    renderPanel();

    expect(screen.getByRole('listbox', { name: 'Search results' })).toBeInTheDocument();
    expect(getResultOptions()).toHaveLength(3);
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    expect(screen.getByText('Shock')).toBeInTheDocument();
    expect(screen.getByText('Giant Growth')).toBeInTheDocument();
  });

  it('ArrowDown highlights the first result while input stays focused', () => {
    const { searchInput } = renderPanel();

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

    const options = getResultOptions();
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(searchInput);
  });

  it('ArrowDown twice highlights the second result', () => {
    const { searchInput } = renderPanel();

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

    const options = getResultOptions();
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(searchInput);
  });

  it('Enter stages the highlighted card and selects input text after rAF', () => {
    const raf = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', raf);

    const { searchInput, onStageCard } = renderPanel();
    const selectSpy = vi.spyOn(searchInput, 'select');

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onStageCard).toHaveBeenCalledTimes(1);
    expect(onStageCard).toHaveBeenCalledWith(threeSearchResults[0]);
    expect(raf).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
    expect(getResultOptions().some((option) => option.getAttribute('aria-selected') === 'true')).toBe(false);
  });

  it('Escape clears the highlight while input stays focused', () => {
    const { searchInput } = renderPanel();

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Escape' });

    expect(getResultOptions().some((option) => option.getAttribute('aria-selected') === 'true')).toBe(false);
    expect(document.activeElement).toBe(searchInput);
  });

  it('mouse enter plus Enter stages the hovered card', () => {
    const { searchInput, onStageCard } = renderPanel();

    fireEvent.mouseEnter(screen.getByText('Giant Growth').closest('[role="option"]')!);
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onStageCard).toHaveBeenCalledWith(threeSearchResults[2]);
  });

  it('Add button stages without prior keyboard highlight', () => {
    const { onStageCard } = renderPanel();

    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[1]);

    expect(onStageCard).toHaveBeenCalledWith(threeSearchResults[1]);
  });

  it('double-clicking a result row stages the card', () => {
    const { onStageCard } = renderPanel();

    fireEvent.doubleClick(screen.getByText('Shock').closest('[role="option"]')!);

    expect(onStageCard).toHaveBeenCalledTimes(1);
    expect(onStageCard).toHaveBeenCalledWith(threeSearchResults[1]);
  });

  it('single click on a result row does not stage', () => {
    const { onStageCard } = renderPanel();

    fireEvent.click(screen.getByText('Shock').closest('[role="option"]')!);

    expect(onStageCard).not.toHaveBeenCalled();
  });

  it('does not stage on ArrowDown alone', () => {
    const { searchInput, onStageCard } = renderPanel();

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

    expect(onStageCard).not.toHaveBeenCalled();
  });

  it('handles empty results without throwing on ArrowDown', () => {
    const inputRef = createRef<HTMLInputElement>();
    renderWithAppProviders(
      <CardPoolSearchPanel
        phaseLabel="Pack 1"
        phaseOptions={['Pack 1']}
        onPhaseLabelChange={vi.fn()}
        searchQuery="missing"
        onSearchQueryChange={vi.fn()}
        searchResults={[]}
        searching={false}
        onStageCard={vi.fn()}
        inputRef={inputRef}
      />,
    );

    const searchInput = screen.getByRole('combobox', { name: 'Search cards' });
    searchInput.focus();
    expect(() => fireEvent.keyDown(searchInput, { key: 'ArrowDown' })).not.toThrow();
    expect(screen.queryByRole('listbox', { name: 'Search results' })).not.toBeInTheDocument();
  });

  it('hides results while searching', () => {
    renderPanel({ searching: true });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('clears highlight when the search query changes', () => {
    const { searchInput, onSearchQueryChange } = renderPanel();

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    expect(getResultOptions()[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(searchInput, { target: { value: 'shock' } });

    expect(onSearchQueryChange).toHaveBeenCalledWith('shock');
    expect(getResultOptions().some((option) => option.getAttribute('aria-selected') === 'true')).toBe(false);
  });
});
