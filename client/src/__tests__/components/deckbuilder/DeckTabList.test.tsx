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
  it('should_render_deck_selector_with_all_deck_options', () => {
    renderWithAppProviders(
      <DeckTabList
        decks={[makeDeck('deck-1', 'Deck 1'), makeDeck('deck-2', 'Deck 2')]}
        activeDeckId="deck-1"
        onActiveDeckChange={vi.fn()}
      />,
    );

    const selector = screen.getByTestId('deck-tab-list');
    expect(selector).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Deck 1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Deck 2' })).toBeInTheDocument();
  });

  it('should_show_active_deck_in_selector', () => {
    renderWithAppProviders(
      <DeckTabList
        decks={[makeDeck('deck-1', 'Deck 1'), makeDeck('deck-2', 'Deck 2')]}
        activeDeckId="deck-1"
        onActiveDeckChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('deck-tab-list')).toHaveValue('deck-1');
  });

  it('should_call_onActiveDeckChange_when_selector_changes', () => {
    const onActiveDeckChange = vi.fn();
    renderWithAppProviders(
      <DeckTabList
        decks={[makeDeck('deck-1', 'Deck 1'), makeDeck('deck-2', 'Deck 2')]}
        activeDeckId="deck-1"
        onActiveDeckChange={onActiveDeckChange}
      />,
    );

    fireEvent.change(screen.getByTestId('deck-tab-list'), { target: { value: 'deck-2' } });
    expect(onActiveDeckChange).toHaveBeenCalledWith('deck-2');
  });

  it('should_render_status_labels_in_option_text', () => {
    const submitted = makeDeck('deck-1', 'Deck 1');
    submitted.status = 'submitted';
    const locked = makeDeck('deck-2', 'Deck 2');
    locked.status = 'locked';

    renderWithAppProviders(<DeckTabList decks={[submitted, locked]} activeDeckId="deck-1" onActiveDeckChange={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'Deck 1 (Registered)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Deck 2 (Locked)' })).toBeInTheDocument();
  });
});
