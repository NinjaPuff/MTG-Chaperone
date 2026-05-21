import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckSidebar } from '../../../components/deckbuilder/DeckSidebar';
import type { BuilderDeck, DeckBuilderCard } from '../../../components/deckbuilder/types';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

function makeDeck(cards: DeckBuilderCard[] = []): BuilderDeck {
  return {
    id: 'deck-1',
    orderIndex: 0,
    name: 'Deck 1',
    status: 'draft',
    cards,
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

function makeCard(overrides: Partial<DeckBuilderCard> = {}): DeckBuilderCard {
  return {
    cachedCardId: overrides.cachedCardId ?? 'card-1',
    name: overrides.name ?? 'Test Card',
    manaCost: overrides.manaCost ?? '{2}',
    typeLine: overrides.typeLine ?? 'Creature',
    cmc: overrides.cmc ?? 2,
    quantity: overrides.quantity ?? 1,
    zone: overrides.zone ?? 'main',
    colorIdentity: overrides.colorIdentity ?? ['G'],
    ...overrides,
  };
}

describe('DeckSidebar', () => {
  it('renders sideboard before basic lands', () => {
    renderWithAppProviders(
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

  it('renders Build/Details toggle when handler is provided', () => {
    renderWithAppProviders(
      <DeckSidebar
        decks={[makeDeck()]}
        activeDeckId="deck-1"
        minDeckSize={40}
        expandedDeckMode={false}
        onExpandedDeckModeChange={vi.fn()}
        onActiveDeckChange={vi.fn()}
        onDeckNameChange={vi.fn()}
        onCardClick={vi.fn()}
        onBasicLandsChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Build' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
  });

  it('updates mana curve when main-deck quantity changes', () => {
    const deck = makeDeck([makeCard({ cmc: 2, quantity: 1 })]);
    const { container, rerender } = renderWithAppProviders(
      <DeckSidebar
        decks={[deck]}
        activeDeckId="deck-1"
        minDeckSize={40}
        onActiveDeckChange={vi.fn()}
        onDeckNameChange={vi.fn()}
        onCardClick={vi.fn()}
        onBasicLandsChange={vi.fn()}
      />,
    );

    expect(container.querySelector('[aria-label="2: 1 total (1 creatures, 0 non-creatures)"]')).toBeInTheDocument();

    rerender(
      <DeckSidebar
        decks={[makeDeck([makeCard({ cmc: 2, quantity: 3 })])]}
        activeDeckId="deck-1"
        minDeckSize={40}
        onActiveDeckChange={vi.fn()}
        onDeckNameChange={vi.fn()}
        onCardClick={vi.fn()}
        onBasicLandsChange={vi.fn()}
      />,
    );

    expect(container.querySelector('[aria-label="2: 3 total (3 creatures, 0 non-creatures)"]')).toBeInTheDocument();
  });

  it('excludes sideboard cards from mana curve buckets', () => {
    const deck = makeDeck([
      makeCard({ cachedCardId: 'sb-1', cmc: 5, quantity: 4, zone: 'sideboard' }),
    ]);
    const { container } = renderWithAppProviders(
      <DeckSidebar
        decks={[deck]}
        activeDeckId="deck-1"
        minDeckSize={40}
        onActiveDeckChange={vi.fn()}
        onDeckNameChange={vi.fn()}
        onCardClick={vi.fn()}
        onBasicLandsChange={vi.fn()}
      />,
    );

    expect(container.querySelector('[aria-label="5: 4 total (4 creatures, 0 non-creatures)"]')).not.toBeInTheDocument();
  });
});
