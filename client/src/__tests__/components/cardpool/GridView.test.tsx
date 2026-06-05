import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridView } from '../../../components/cardpool/GridView';
import type { PoolCard } from '../../../components/cardpool/types';
import { mockMatchMedia, restoreMatchMedia } from '../../helpers/matchMedia';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

const cards: PoolCard[] = [
  {
    scryfallId: 'card-1',
    name: 'Lightning Bolt',
    layout: null,
    manaCost: '{R}',
    typeLine: 'Instant',
    rarity: 'common',
    setCode: 'LEA',
    imageUris: { normal: 'https://example.com/bolt.jpg' },
    cmc: 1,
    colors: ['R'],
    colorIdentity: ['R'],
    quantity: 1,
    phaseLabel: 'Initial Pool',
    phaseQuantities: { 'Initial Pool': 1 },
  },
];

describe('GridView', () => {
  beforeEach(() => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
  });

  afterEach(() => {
    restoreMatchMedia();
  });

  it('wires getTouchActions to touch action handlers', () => {
    const onAdd = vi.fn();
    renderWithAppProviders(
      <GridView
        cards={cards}
        sortKey="name"
        groupMode="flat"
        organizeBy="type"
        cardWidth={200}
        getTouchActions={() => [{ label: 'Add to main deck', onAction: onAdd }]}
      />,
    );

    fireEvent.click(screen.getByRole('img', { name: 'Lightning Bolt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to main deck' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders cards without touch actions', () => {
    renderWithAppProviders(
      <GridView cards={cards} sortKey="name" groupMode="flat" organizeBy="type" cardWidth={200} />,
    );

    expect(screen.getByRole('img', { name: 'Lightning Bolt' })).toBeInTheDocument();
  });

  it('should_anchor_pool_badge_at_top_left_when_renderBadge_provided', () => {
    renderWithAppProviders(
      <GridView
        cards={cards}
        sortKey="name"
        groupMode="flat"
        organizeBy="type"
        cardWidth={200}
        renderBadge={() => <span>in deck 1</span>}
      />,
    );

    const anchor = screen.getByTestId('pool-card-badge-anchor');
    expect(anchor).toHaveClass('top-1', 'left-1');
    expect(anchor).not.toHaveClass('bottom-1');
  });

  it('should_apply_auto_fill_grid_template_from_cardWidth', () => {
    const { container } = renderWithAppProviders(
      <GridView cards={cards} sortKey="name" groupMode="flat" organizeBy="type" cardWidth={200} />,
    );

    const grid = container.querySelector('[style*="repeat(auto-fill, minmax(200px, 1fr))"]');
    expect(grid).toBeTruthy();
  });
});
