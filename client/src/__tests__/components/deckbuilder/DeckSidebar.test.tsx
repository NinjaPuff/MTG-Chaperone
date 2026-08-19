import type React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
    layout: overrides.layout ?? null,
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

const defaultSidebarProps = {
  decks: [makeDeck()],
  activeDeckId: 'deck-1',
  minDeckSize: 40,
  onDeckNameChange: vi.fn(),
  onCardClick: vi.fn(),
  onBasicLandsChange: vi.fn(),
  onSideboardBasicLandsChange: vi.fn(),
};

describe('DeckSidebar', () => {
  it('renders sideboard before basic lands button', () => {
    renderWithAppProviders(<DeckSidebar {...defaultSidebarProps} />);

    const sideboard = screen.getByRole('button', { name: /Sideboard/i });
    const basicLandsButton = screen.getByRole('button', { name: 'Basic Lands' });

    expect(sideboard.compareDocumentPosition(basicLandsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suggest Lands' })).not.toBeInTheDocument();
  });

  it('opens basic lands popup with land controls when button is clicked', () => {
    renderWithAppProviders(<DeckSidebar {...defaultSidebarProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest Lands' })).toBeInTheDocument();
    expect(screen.getByText('Plains')).toBeInTheDocument();
  });

  it('should_not_render_build_details_toggle', () => {
    renderWithAppProviders(<DeckSidebar {...defaultSidebarProps} />);

    expect(screen.queryByRole('button', { name: 'Build' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
  });

  it('should_render_mini_mana_curve_preview_on_build_screen', () => {
    renderWithAppProviders(
      <DeckSidebar {...defaultSidebarProps} decks={[makeDeck([makeCard({ cmc: 2, quantity: 1 })])]} />,
    );

    expect(screen.getByTestId('deck-sidebar-mana-curve')).toBeInTheDocument();
    expect(screen.getByText('Creatures')).toBeInTheDocument();
    expect(screen.getByText('Non-creatures')).toBeInTheDocument();
  });

  it('updates mana curve when main-deck quantity changes', () => {
    const deck = makeDeck([makeCard({ cmc: 2, quantity: 1 })]);
    const { container, rerender } = renderWithAppProviders(
      <DeckSidebar {...defaultSidebarProps} decks={[deck]} />,
    );

    expect(container.querySelector('[aria-label="2: 1 total (1 creatures, 0 non-creatures)"]')).toBeInTheDocument();

    rerender(
      <DeckSidebar
        {...defaultSidebarProps}
        decks={[makeDeck([makeCard({ cmc: 2, quantity: 3 })])]}
      />,
    );

    expect(container.querySelector('[aria-label="2: 3 total (3 creatures, 0 non-creatures)"]')).toBeInTheDocument();
  });

  it('excludes sideboard cards from mana curve buckets', () => {
    const deck = makeDeck([
      makeCard({ cachedCardId: 'sb-1', cmc: 5, quantity: 4, zone: 'sideboard' }),
    ]);
    const { container } = renderWithAppProviders(
      <DeckSidebar {...defaultSidebarProps} decks={[deck]} />,
    );

    expect(container.querySelector('[aria-label="5: 4 total (4 creatures, 0 non-creatures)"]')).not.toBeInTheDocument();
  });

  it('should_expose_main_deck_scroll_container_with_testid', () => {
    renderSidebar(<DeckSidebar {...defaultSidebarProps} />);

    const mainScroll = screen.getByTestId('deck-sidebar-main-scroll');
    expect(mainScroll).toHaveClass('overflow-y-auto');
  });

  it('should_start_with_sideboard_collapsed', () => {
    renderSidebar(<DeckSidebar {...defaultSidebarProps} />);

    expect(screen.getByRole('button', { name: /Sideboard/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('deck-sidebar-sideboard-scroll')).not.toBeInTheDocument();
  });

  it('should_expose_sideboard_scroll_container_with_testid_when_expanded', () => {
    renderSidebar(<DeckSidebar {...defaultSidebarProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Sideboard/i }));

    const sideboardScroll = screen.getByTestId('deck-sidebar-sideboard-scroll');
    expect(sideboardScroll).toHaveClass('overflow-y-auto');
  });

  it('hides_sideboard_panel_when_collapsed', () => {
    renderSidebar(<DeckSidebar {...defaultSidebarProps} />);

    const toggle = screen.getByRole('button', { name: /Sideboard/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryByTestId('deck-sidebar-sideboard-scroll')).not.toBeInTheDocument();
    expect(screen.queryByText('Right-click pool cards to add.')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows_sideboard_panel_again_when_re_expanded', () => {
    renderSidebar(<DeckSidebar {...defaultSidebarProps} />);

    const toggle = screen.getByRole('button', { name: /Sideboard/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getByTestId('deck-sidebar-sideboard-scroll')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('should_show_actionable_sideboard_empty_text', () => {
    renderSidebar(<DeckSidebar {...defaultSidebarProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Sideboard/i }));

    expect(screen.getByText('Right-click pool cards to add.')).toBeInTheDocument();
    expect(screen.queryByText('Always visible drop zone.')).not.toBeInTheDocument();
  });

  it('renders prep size toggle when provided', () => {
    renderWithAppProviders(
      <DeckSidebar
        {...defaultSidebarProps}
        prepSizeToggle={{ value: 60, onChange: vi.fn() }}
      />,
    );

    expect(screen.getByTestId('deck-sidebar-prep-size-toggle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '40' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60' })).toBeInTheDocument();
  });

  it('does not render prep size toggle when omitted', () => {
    renderWithAppProviders(<DeckSidebar {...defaultSidebarProps} />);

    expect(screen.queryByTestId('deck-sidebar-prep-size-toggle')).not.toBeInTheDocument();
  });

  it('excludes sideboard cards from suggest-lands calculation', async () => {
    const onBasicLandsChange = vi.fn();
    const mainCards = Array.from({ length: 26 }, (_, i) =>
      makeCard({
        cachedCardId: `main-${i}`,
        name: `Spell ${i}`,
        manaCost: '{1}{G}',
        typeLine: 'Creature',
        cmc: 2,
        quantity: 1,
        zone: 'main',
        colorIdentity: ['G'],
      }),
    );
    const sideboardCards = Array.from({ length: 20 }, (_, i) =>
      makeCard({
        cachedCardId: `sb-${i}`,
        name: `SB Card ${i}`,
        manaCost: '{1}{R}',
        typeLine: 'Creature',
        cmc: 2,
        quantity: 1,
        zone: 'sideboard',
        colorIdentity: ['R'],
      }),
    );

    renderSidebar(
      <DeckSidebar
        {...defaultSidebarProps}
        decks={[makeDeck([...mainCards, ...sideboardCards])]}
        onBasicLandsChange={onBasicLandsChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest Lands' }));

    await waitFor(() => {
      expect(onBasicLandsChange).toHaveBeenCalledTimes(1);
    });
    const suggested = onBasicLandsChange.mock.calls[0][1];
    const totalLands = suggested.Plains + suggested.Island + suggested.Swamp + suggested.Mountain + suggested.Forest + suggested.Wastes;
    expect(totalLands).toBe(14);
    expect(suggested.Forest).toBe(14);
  });

  it('shows_a_pencil_button_when_renaming_is_enabled', () => {
    renderWithAppProviders(<DeckSidebar {...defaultSidebarProps} />);

    expect(screen.getByTestId('deck-rename-button')).toBeInTheDocument();
  });

  it('hides_the_pencil_button_when_renaming_is_disabled', () => {
    renderWithAppProviders(<DeckSidebar {...defaultSidebarProps} disabled nameDisabled />);

    expect(screen.queryByTestId('deck-rename-button')).not.toBeInTheDocument();
  });

  it('allows_renaming_when_content_is_disabled_but_name_is_enabled', () => {
    const onDeckNameChange = vi.fn();
    renderWithAppProviders(
      <DeckSidebar
        {...defaultSidebarProps}
        disabled
        nameDisabled={false}
        onDeckNameChange={onDeckNameChange}
      />,
    );

    fireEvent.click(screen.getByTestId('deck-rename-button'));
    const input = screen.getByDisplayValue('Deck 1');
    fireEvent.change(input, { target: { value: 'Azorius Control' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onDeckNameChange).toHaveBeenCalledWith('deck-1', 'Azorius Control');
  });

  it('should_forward_contextmenu_from_main_deck_row_to_onCardContextMenu', () => {
    const onCardContextMenu = vi.fn();
    const card = makeCard({ cachedCardId: 'card-1', name: 'Grizzly Bears' });

    renderSidebar(
      <DeckSidebar
        {...defaultSidebarProps}
        decks={[makeDeck([card])]}
        onCardContextMenu={onCardContextMenu}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /1x Grizzly Bears/i }));
    expect(onCardContextMenu).toHaveBeenCalledTimes(1);
    expect(onCardContextMenu.mock.calls[0][1]).toEqual(card);
    expect(onCardContextMenu.mock.calls[0][2]).toBe('deck-1');
  });
});
