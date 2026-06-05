import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckTabList } from '../../../components/deckbuilder/DeckTabList';
import type { BuilderDeck } from '../../../components/deckbuilder/types';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

function makeDeck(id: string, name: string): BuilderDeck {
  return {
    id,
    orderIndex: 0,
    name,
    status: 'draft',
    cards: [],
    basicLands: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
      Wastes: 0,
    },
  };
}

describe('DeckTabList', () => {
  it('should_render_all_deck_names_as_tabs', () => {
    renderWithAppProviders(
      <DeckTabList
        decks={[makeDeck('deck-1', 'Deck 1'), makeDeck('deck-2', 'Deck 2')]}
        activeDeckId="deck-1"
        onActiveDeckChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('deck-tab-list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deck 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deck 2' })).toBeInTheDocument();
  });

  it('should_highlight_active_deck_tab', () => {
    renderWithAppProviders(
      <DeckTabList
        decks={[makeDeck('deck-1', 'Deck 1'), makeDeck('deck-2', 'Deck 2')]}
        activeDeckId="deck-1"
        onActiveDeckChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('deck-tab-deck-1')).toHaveClass('border-primary');
    expect(screen.getByTestId('deck-tab-deck-2')).toHaveClass('border-border');
  });

  it('should_call_onActiveDeckChange_when_inactive_tab_clicked', () => {
    const onActiveDeckChange = vi.fn();
    renderWithAppProviders(
      <DeckTabList
        decks={[makeDeck('deck-1', 'Deck 1'), makeDeck('deck-2', 'Deck 2')]}
        activeDeckId="deck-1"
        onActiveDeckChange={onActiveDeckChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deck 2' }));
    expect(onActiveDeckChange).toHaveBeenCalledWith('deck-2');
  });
});
