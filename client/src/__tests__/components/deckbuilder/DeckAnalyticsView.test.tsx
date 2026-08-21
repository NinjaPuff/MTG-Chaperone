import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckAnalyticsView } from '../../../components/deckbuilder/DeckAnalyticsView';
import type { BuilderDeck, DeckBuilderCard } from '../../../components/deckbuilder/types';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

vi.mock('@/hooks/useCardImageWidth', () => ({
  useCardImageWidth: () => ({
    cardImageWidth: 160,
    setCardImageWidth: vi.fn(),
  }),
}));

function makeDeckCard(overrides: Partial<DeckBuilderCard>): DeckBuilderCard {
  return {
    cachedCardId: overrides.cachedCardId ?? 'card-1',
    name: overrides.name ?? 'Card',
    layout: overrides.layout ?? null,
    manaCost: overrides.manaCost ?? null,
    typeLine: overrides.typeLine ?? 'Creature — Test',
    cmc: overrides.cmc ?? 1,
    quantity: overrides.quantity ?? 1,
    zone: overrides.zone ?? 'main',
    colorIdentity: overrides.colorIdentity ?? [],
  };
}

function makeCurveFixtureDeck(): BuilderDeck {
  return {
    id: 'deck-curve',
    orderIndex: 0,
    name: 'Curve Deck',
    status: 'draft',
    cards: [
      makeDeckCard({
        cachedCardId: 'bolt',
        name: 'Lightning Bolt',
        manaCost: '{R}',
        typeLine: 'Instant',
        cmc: 1,
        colorIdentity: ['R'],
      }),
      makeDeckCard({
        cachedCardId: 'plains',
        name: 'Plains',
        typeLine: 'Basic Land — Plains',
        cmc: 0,
      }),
    ],
    basicLands: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    },
  };
}

function makeDeck(): BuilderDeck {
  return {
    id: 'deck-1',
    orderIndex: 0,
    name: 'Test Deck',
    status: 'draft',
    cards: [
      makeDeckCard({
        cachedCardId: 'card-1',
        name: 'Lightning Bolt',
        manaCost: '{R}',
        typeLine: 'Instant',
        cmc: 1,
        colorIdentity: ['R'],
      }),
    ],
    basicLands: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    },
  };
}

function makeSplitDeck(): BuilderDeck {
  return {
    id: 'deck-split',
    orderIndex: 0,
    name: 'Split Deck',
    status: 'draft',
    cards: [
      makeDeckCard({
        cachedCardId: 'bear',
        name: 'Bear',
        typeLine: 'Creature — Bear',
        cmc: 2,
        quantity: 2,
        zone: 'main',
      }),
      makeDeckCard({
        cachedCardId: 'bolt',
        name: 'Bolt',
        typeLine: 'Instant',
        manaCost: '{R}',
        cmc: 2,
        quantity: 1,
        zone: 'main',
        colorIdentity: ['R'],
      }),
      makeDeckCard({
        cachedCardId: 'elf',
        name: 'Elf',
        typeLine: 'Creature — Elf',
        cmc: 1,
        quantity: 1,
        zone: 'sideboard',
      }),
    ],
    basicLands: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    },
  };
}

describe('DeckAnalyticsView', () => {
  it('renders_card_images_in_curve_view_when_pool_images_are_provided', () => {
    const poolImageByCardId = new Map([['card-1', 'https://example.com/bolt.jpg']]);

    renderWithAppProviders(
      <DeckAnalyticsView deck={makeDeck()} poolImageByCardId={poolImageByCardId} />,
    );

    expect(screen.getByRole('img', { name: 'Lightning Bolt' })).toHaveAttribute(
      'src',
      'https://example.com/bolt.jpg',
    );
  });

  it('falls_back_to_text_placeholder_when_pool_images_are_missing', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeDeck()} />);

    expect(screen.queryByRole('img', { name: 'Lightning Bolt' })).not.toBeInTheDocument();
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
  });

  it('shows_creature_and_non_creature_curve_rows_by_default', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeSplitDeck()} />);

    const mainSection = screen.getByRole('heading', { name: 'Main Deck' }).parentElement!;
    expect(within(mainSection).getByText(/Creatures \(2\)/)).toBeInTheDocument();
    expect(within(mainSection).getByText(/Non-Creatures \(1\)/)).toBeInTheDocument();

    const sideboardSection = screen.getByRole('heading', { name: 'Sideboard' }).parentElement!;
    expect(within(sideboardSection).getByText(/Creatures \(1\)/)).toBeInTheDocument();
    expect(within(sideboardSection).queryByText(/^Non-Creatures \(/)).toBeNull();
  });

  it('combines_curve_rows_when_combined_curve_is_checked', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeSplitDeck()} />);

    expect(screen.getByTestId('deck-analytics-combined-curve')).not.toBeChecked();
    fireEvent.click(screen.getByTestId('deck-analytics-combined-curve'));
    expect(screen.getByTestId('deck-analytics-combined-curve')).toBeChecked();

    expect(screen.queryByText(/^Creatures \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Non-Creatures \(/)).not.toBeInTheDocument();

    const mainSection = screen.getByRole('heading', { name: 'Main Deck' }).parentElement!;
    expect(within(mainSection).getByText('(3)')).toBeInTheDocument();
  });

  it('hides_combined_curve_toggle_on_stacks_view', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeSplitDeck()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stacks' }));
    expect(screen.queryByTestId('deck-analytics-combined-curve')).not.toBeInTheDocument();
  });

  it('renders_mini_curve_below_details_views', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeSplitDeck()} />);

    expect(screen.getByTestId('deck-analytics-mini-curve')).toBeInTheDocument();
    expect(screen.getByText('Mini Curve')).toBeInTheDocument();
  });

  it('supports_click_to_remove_in_editable_details', () => {
    const onCardClick = vi.fn();
    renderWithAppProviders(
      <DeckAnalyticsView deck={makeSplitDeck()} editable onCardClick={onCardClick} />,
    );

    fireEvent.click(screen.getByText('Bear'));
    expect(onCardClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('deck-analytics-enable-editing'));
    fireEvent.click(screen.getByText('Bear'));

    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({
        cachedCardId: 'bear',
        zone: 'main',
      }),
      'deck-split',
    );
  });

  it('should_not_count_land_in_mini_curve_zero_bucket', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeCurveFixtureDeck()} />);

    const miniCurve = screen.getByTestId('deck-analytics-mini-curve');
    expect(within(miniCurve).queryByLabelText(/^0:/)).not.toBeInTheDocument();
  });

  it('should_count_one_drop_in_mini_curve', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeCurveFixtureDeck()} />);

    const miniCurve = screen.getByTestId('deck-analytics-mini-curve');
    expect(within(miniCurve).getByLabelText(/1: 1 total/)).toBeInTheDocument();
  });

  it('should_not_call_onCardClick_when_not_editable', () => {
    const onCardClick = vi.fn();
    const onCardContextMenu = vi.fn();
    renderWithAppProviders(
      <DeckAnalyticsView
        deck={makeCurveFixtureDeck()}
        onCardClick={onCardClick}
        onCardContextMenu={onCardContextMenu}
      />,
    );

    expect(screen.getByTestId('deck-analytics-enable-editing')).toBeDisabled();
    fireEvent.click(screen.getByText('Lightning Bolt'));
    fireEvent.contextMenu(screen.getByText('Lightning Bolt'));

    expect(onCardClick).not.toHaveBeenCalled();
    expect(onCardContextMenu).not.toHaveBeenCalled();
  });

  it('should_call_onCardContextMenu_when_editable_and_card_contextmenu', () => {
    const onCardContextMenu = vi.fn();
    renderWithAppProviders(
      <DeckAnalyticsView deck={makeCurveFixtureDeck()} editable onCardContextMenu={onCardContextMenu} />,
    );

    fireEvent.contextMenu(screen.getByText('Lightning Bolt'));
    expect(onCardContextMenu).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('deck-analytics-enable-editing'));
    fireEvent.contextMenu(screen.getByText('Lightning Bolt'));

    expect(onCardContextMenu).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cachedCardId: 'bolt',
        zone: 'main',
      }),
      'deck-curve',
    );
  });

  it('should_remove_stack_card_when_editing_enabled', () => {
    const onCardClick = vi.fn();
    renderWithAppProviders(
      <DeckAnalyticsView deck={makeSplitDeck()} editable onCardClick={onCardClick} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stacks' }));
    fireEvent.click(screen.getByTestId('deck-analytics-enable-editing'));
    fireEvent.click(screen.getAllByText('Bear')[0]!);

    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({
        cachedCardId: 'bear',
        zone: 'main',
      }),
      'deck-split',
    );
  });

  it('should_show_build_hint_in_details', () => {
    renderWithAppProviders(<DeckAnalyticsView deck={makeCurveFixtureDeck()} />);

    expect(screen.getByTestId('deck-analytics-build-hint')).toBeInTheDocument();
  });
});
