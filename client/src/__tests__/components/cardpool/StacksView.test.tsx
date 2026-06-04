import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StacksView } from '../../../components/cardpool/StacksView';
import { CardPreviewProvider } from '../../../components/cardpool/CardPreviewContext';
import type { PoolCard } from '../../../components/cardpool/types';
import { stackBadgeTopPx } from '../../../lib/stackBadgeLayout';

function makeCard(id: string, overrides: Partial<PoolCard> = {}): PoolCard {
  return {
    scryfallId: id,
    name: `Card ${id}`,
    manaCost: '{1}',
    typeLine: 'Creature',
    rarity: 'common',
    setCode: 'TST',
    imageUris: { normal: `https://example.com/${id}.jpg` },
    cmc: 1,
    colors: ['G'],
    colorIdentity: ['G'],
    quantity: 1,
    phaseLabel: 'Initial Pool',
    phaseQuantities: { 'Initial Pool': 1 },
    ...overrides,
  };
}

describe('stackBadgeLayout', () => {
  const peekHeight = 68;

  it('should_return_zero_when_index_is_only_card_in_stack', () => {
    expect(stackBadgeTopPx(0, peekHeight)).toBe(0);
  });

  it('should_return_peekHeight_when_index_is_middle_of_three_card_stack', () => {
    expect(stackBadgeTopPx(1, peekHeight)).toBe(peekHeight);
  });

  it('should_return_double_peekHeight_when_index_is_front_of_three_card_stack', () => {
    expect(stackBadgeTopPx(2, peekHeight)).toBe(2 * peekHeight);
  });
});

describe('StacksView badges', () => {
  it('renders column-level badges with stable indices', () => {
    const cards = [makeCard('a'), makeCard('b'), makeCard('c')];

    render(
      <CardPreviewProvider>
        <StacksView
          cards={cards}
          sortKey="name"
          groupMode="flat"
          cardWidth={200}
          organizeBy="type"
          renderBadge={(card) => <span data-testid={`badge-${card.scryfallId}`}>in deck</span>}
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByTestId('badge-a')).toBeInTheDocument();
    expect(screen.getByTestId('badge-b')).toBeInTheDocument();
    expect(screen.getByTestId('badge-c')).toBeInTheDocument();

    const badgeB = screen.getByTestId('badge-b').closest('[data-badge-index]');
    const badgeC = screen.getByTestId('badge-c').closest('[data-badge-index]');
    expect(badgeB).toHaveAttribute('data-badge-index', '1');
    expect(badgeC).toHaveAttribute('data-badge-index', '2');
  });

  it('should_position_front_stack_badge_at_slice_top_plus_inset', () => {
    const cardWidth = 200;
    const cardHeight = Math.round((cardWidth * 680) / 488);
    const peekHeight = Math.max(48, Math.round(cardHeight * 0.24));
    const cards = [makeCard('a'), makeCard('b'), makeCard('c')];

    render(
      <CardPreviewProvider>
        <StacksView
          cards={cards}
          sortKey="name"
          groupMode="flat"
          cardWidth={cardWidth}
          organizeBy="type"
          renderBadge={(card) => <span data-testid={`badge-${card.scryfallId}`}>in deck</span>}
        />
      </CardPreviewProvider>,
    );

    const frontBadge = screen.getByTestId('badge-c').closest('[data-badge-index]');
    expect(frontBadge).toHaveStyle({ top: `${2 * peekHeight + 4}px` });
  });

  it('should_not_use_translate_y_full_on_badge_wrapper', () => {
    render(
      <CardPreviewProvider>
        <StacksView
          cards={[makeCard('a'), makeCard('b')]}
          sortKey="name"
          groupMode="flat"
          cardWidth={200}
          organizeBy="type"
          renderBadge={(card) => <span data-testid={`badge-${card.scryfallId}`}>in deck</span>}
        />
      </CardPreviewProvider>,
    );

    const wrappers = document.querySelectorAll('[data-badge-index]');
    wrappers.forEach((wrapper) => {
      expect(wrapper).not.toHaveClass('-translate-y-full');
    });
  });

  it('shows quantity badge on card wrapper', () => {
    render(
      <CardPreviewProvider>
        <StacksView
          cards={[makeCard('a', { quantity: 4 })]}
          sortKey="name"
          groupMode="flat"
          cardWidth={200}
          organizeBy="type"
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByText('x4')).toBeInTheDocument();
  });
});
