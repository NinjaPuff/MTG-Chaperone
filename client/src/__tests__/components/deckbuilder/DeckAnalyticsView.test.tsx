import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckAnalyticsView } from '../../../components/deckbuilder/DeckAnalyticsView';
import type { BuilderDeck } from '../../../components/deckbuilder/types';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

vi.mock('@/hooks/useCardImageWidth', () => ({
  useCardImageWidth: () => ({
    cardImageWidth: 160,
    setCardImageWidth: vi.fn(),
  }),
}));

function makeDeck(): BuilderDeck {
  return {
    id: 'deck-1',
    orderIndex: 0,
    name: 'Test Deck',
    status: 'draft',
    cards: [
      {
        cachedCardId: 'card-1',
        name: 'Lightning Bolt',
        layout: null,
        manaCost: '{R}',
        typeLine: 'Instant',
        cmc: 1,
        quantity: 1,
        zone: 'main',
        colorIdentity: ['R'],
      },
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
});
