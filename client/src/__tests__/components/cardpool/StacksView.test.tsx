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
  it('positions badges at the top of each stack slice', () => {
    const peekHeight = 48;

    expect(stackBadgeTopPx(0, peekHeight)).toBe(4);
    expect(stackBadgeTopPx(1, peekHeight)).toBe(peekHeight + 4);
    expect(stackBadgeTopPx(2, peekHeight)).toBe(2 * peekHeight + 4);
    expect(stackBadgeTopPx(2, peekHeight)).toBeGreaterThan(stackBadgeTopPx(1, peekHeight));
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
    expect(badgeB).not.toHaveClass('bottom-1');
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
