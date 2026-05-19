import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckSidebar } from '../../../components/deckbuilder/DeckSidebar';
import type { BuilderDeck } from '../../../components/deckbuilder/types';

function makeDeck(): BuilderDeck {
  return {
    id: 'deck-1',
    orderIndex: 0,
    name: 'Deck 1',
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

describe('DeckSidebar', () => {
  it('renders sideboard before basic lands', () => {
    render(
      <DeckSidebar
        decks={[makeDeck()]}
        activeDeckId="deck-1"
        minDeckSize={40}
        onActiveDeckChange={vi.fn()}
        onDeckNameChange={vi.fn()}
        onCardClick={vi.fn()}
        onBasicLandsChange={vi.fn()}
      />,
    );

    const sideboard = screen.getByText('Sideboard');
    const suggestButton = screen.getByRole('button', { name: 'Suggest Lands' });

    expect(sideboard.compareDocumentPosition(suggestButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
