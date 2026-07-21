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
      Wastes: 0,
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
      Wastes: 0,
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
});
