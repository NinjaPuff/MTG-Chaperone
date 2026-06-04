import type React from 'react';
import { fireEvent, screen } from '@testing-library/react';
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

function renderSidebar(ui: React.ReactElement) {
  return renderWithAppProviders(<div className="h-[600px]">{ui}</div>);
}

describe('DeckSidebar', () => {
  it('renders sideboard before basic lands button', () => {
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

    const sideboard = screen.getByRole('button', { name: /Sideboard/i });
    const basicLandsButton = screen.getByRole('button', { name: 'Basic Lands' });

    expect(sideboard.compareDocumentPosition(basicLandsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suggest Lands' })).not.toBeInTheDocument();
  });

  it('opens basic lands popup with land controls when button is clicked', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest Lands' })).toBeInTheDocument();
    expect(screen.getByText('Plains')).toBeInTheDocument();
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

  it('should_expose_main_deck_scroll_container_with_testid', () => {
    renderSidebar(
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

    const mainScroll = screen.getByTestId('deck-sidebar-main-scroll');
    expect(mainScroll).toHaveClass('overflow-y-auto');
  });

  it('should_expose_sideboard_scroll_container_with_testid_when_expanded', () => {
    renderSidebar(
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

    const sideboardScroll = screen.getByTestId('deck-sidebar-sideboard-scroll');
    expect(sideboardScroll).toHaveClass('overflow-y-auto');
  });

  it('hides_sideboard_panel_when_collapsed', () => {
    renderSidebar(
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

    fireEvent.click(screen.getByRole('button', { name: /Sideboard/i }));

    expect(screen.queryByTestId('deck-sidebar-sideboard-scroll')).not.toBeInTheDocument();
    expect(screen.queryByText('Right-click pool cards to add.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sideboard/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows_sideboard_panel_again_when_re_expanded', () => {
    renderSidebar(
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

    const toggle = screen.getByRole('button', { name: /Sideboard/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getByTestId('deck-sidebar-sideboard-scroll')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('should_show_actionable_sideboard_empty_text', () => {
    renderSidebar(
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

    expect(screen.getByText('Right-click pool cards to add.')).toBeInTheDocument();
    expect(screen.queryByText('Always visible drop zone.')).not.toBeInTheDocument();
  });

  it('should_forward_contextmenu_from_main_deck_row_to_onCardContextMenu', () => {
    const onCardContextMenu = vi.fn();
    const card = makeCard({ cachedCardId: 'card-1', name: 'Grizzly Bears' });

    renderSidebar(
      <DeckSidebar
        decks={[makeDeck([card])]}
        activeDeckId="deck-1"
        minDeckSize={40}
        onActiveDeckChange={vi.fn()}
        onDeckNameChange={vi.fn()}
        onCardClick={vi.fn()}
        onCardContextMenu={onCardContextMenu}
        onBasicLandsChange={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /1x Grizzly Bears/i }));
    expect(onCardContextMenu).toHaveBeenCalledTimes(1);
    expect(onCardContextMenu.mock.calls[0][1]).toEqual(card);
    expect(onCardContextMenu.mock.calls[0][2]).toBe('deck-1');
  });
});
