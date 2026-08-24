import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardPreviewProvider } from '../../../components/cardpool/CardPreviewContext';
import { CurveView } from '../../../components/cardpool/CurveView';
import type { PoolCard } from '../../../components/cardpool/types';

function makeCard(overrides: Partial<PoolCard> = {}): PoolCard {
  return {
    scryfallId: overrides.scryfallId ?? 'card-1',
    name: overrides.name ?? 'Bolt',
    layout: overrides.layout ?? null,
    manaCost: overrides.manaCost ?? '{R}',
    typeLine: overrides.typeLine ?? 'Instant',
    rarity: overrides.rarity ?? 'common',
    setCode: overrides.setCode ?? 'TST',
    imageUris: overrides.imageUris ?? null,
    cmc: overrides.cmc ?? 1,
    colors: overrides.colors ?? ['R'],
    colorIdentity: overrides.colorIdentity ?? ['R'],
    quantity: overrides.quantity ?? 4,
    phaseLabel: overrides.phaseLabel ?? 'Initial Pool',
    phaseQuantities: overrides.phaseQuantities ?? { 'Initial Pool': overrides.quantity ?? 4 },
  };
}

describe('CurveView', () => {
  it('does not render lands in the curve columns', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[
            makeCard({ scryfallId: 'land-1', name: 'Plains', typeLine: 'Basic Land — Plains', cmc: 0, quantity: 1 }),
            makeCard({ scryfallId: 'spell-1', name: 'Ornithopter', typeLine: 'Artifact Creature — Thopter', cmc: 0, quantity: 1 }),
          ]}
          sortKey="name"
          groupMode="flat"
          organizeBy="cmc"
          cardWidth={180}
        />
      </CardPreviewProvider>,
    );

    expect(screen.queryByText('Plains')).not.toBeInTheDocument();
    expect(screen.getByText('Ornithopter')).toBeInTheDocument();
  });

  it('shows total copy count in the mana bucket label', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[makeCard({ cmc: 1, quantity: 4 })]}
          sortKey="name"
          groupMode="flat"
          organizeBy="cmc"
          cardWidth={180}
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.queryByText('(1)')).not.toBeInTheDocument();
  });

  it('shows total copy count beside organize-by group heading', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[
            makeCard({ scryfallId: 'c1', name: 'Bear', typeLine: 'Creature — Bear', cmc: 2, quantity: 2 }),
            makeCard({ scryfallId: 'c2', name: 'Elf', typeLine: 'Creature — Elf', cmc: 1, quantity: 3 }),
          ]}
          sortKey="name"
          groupMode="flat"
          organizeBy="type"
          cardWidth={180}
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByText(/Creature \(5\)/)).toBeInTheDocument();
  });

  it('should_size_card_wrapper_to_cardWidth_prop', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[makeCard({ cmc: 1, quantity: 1 })]}
          sortKey="name"
          groupMode="flat"
          organizeBy="cmc"
          cardWidth={180}
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByTestId('curve-card-wrapper')).toHaveStyle({ width: '180px' });
  });

  it('should_anchor_pool_badge_at_top_left_when_renderBadge_provided', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[makeCard({ cmc: 1, quantity: 1 })]}
          sortKey="name"
          groupMode="flat"
          organizeBy="cmc"
          cardWidth={180}
          renderBadge={() => <span>in deck 1</span>}
        />
      </CardPreviewProvider>,
    );

    const anchor = screen.getByTestId('pool-card-badge-anchor');
    expect(anchor).toHaveClass('left-1');
    expect(anchor).toHaveStyle({ top: '4px' });
    expect(anchor).not.toHaveClass('bottom-1');
  });

  it('should_scroll_horizontally_when_curve_columns_exceed_viewport', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[makeCard({ cmc: 1, quantity: 1 })]}
          sortKey="name"
          groupMode="flat"
          organizeBy="cmc"
          cardWidth={280}
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByTestId('curve-columns-scroll')).toHaveClass('overflow-x-auto');
  });

  it('renders creature and non-creature split rows with scoped bucket counts', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[
            makeCard({ scryfallId: 'c1', name: 'Bear', typeLine: 'Creature — Bear', cmc: 2, quantity: 2 }),
            makeCard({ scryfallId: 'c2', name: 'Bolt', typeLine: 'Instant', cmc: 2, quantity: 1 }),
            makeCard({ scryfallId: 'c3', name: 'Elf', typeLine: 'Creature — Elf', cmc: 1, quantity: 3 }),
          ]}
          sortKey="name"
          groupMode="flat"
          organizeBy="creature_split"
          cardWidth={180}
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByText(/Creatures \(5\)/)).toBeInTheDocument();
    expect(screen.getByText(/Non-Creatures \(1\)/)).toBeInTheDocument();

    const creaturesHeading = screen.getByRole('heading', { name: /Creatures \(5\)/ });
    const creaturesSection = creaturesHeading.parentElement!;
    expect(within(creaturesSection).getByText('2')).toBeInTheDocument();
    expect(within(creaturesSection).getByText('(2)')).toBeInTheDocument();

    const nonCreaturesHeading = screen.getByRole('heading', { name: /Non-Creatures \(1\)/ });
    const nonCreaturesSection = nonCreaturesHeading.parentElement!;
    expect(within(nonCreaturesSection).getByText('2')).toBeInTheDocument();
    expect(within(nonCreaturesSection).getByText('(1)')).toBeInTheDocument();
  });

  it('omits empty creature_split groups', () => {
    const { rerender } = render(
      <CardPreviewProvider>
        <CurveView
          cards={[makeCard({ scryfallId: 'c1', name: 'Bear', typeLine: 'Creature — Bear', cmc: 2, quantity: 2 })]}
          sortKey="name"
          groupMode="flat"
          organizeBy="creature_split"
          cardWidth={180}
        />
      </CardPreviewProvider>,
    );

    expect(screen.queryByText(/Non-Creatures/)).not.toBeInTheDocument();

    rerender(
      <CardPreviewProvider>
        <CurveView
          cards={[makeCard({ scryfallId: 'c2', name: 'Bolt', typeLine: 'Instant', cmc: 2, quantity: 1 })]}
          sortKey="name"
          groupMode="flat"
          organizeBy="creature_split"
          cardWidth={180}
        />
      </CardPreviewProvider>,
    );

    expect(screen.queryByText(/^Creatures \(/)).not.toBeInTheDocument();
  });

  it('renders column-level badges in curve stacks instead of bottom-left card badges', () => {
    render(
      <CardPreviewProvider>
        <CurveView
          cards={[
            makeCard({ scryfallId: 'a', cmc: 1 }),
            makeCard({ scryfallId: 'b', cmc: 1 }),
          ]}
          sortKey="name"
          groupMode="flat"
          organizeBy="cmc"
          cardWidth={180}
          renderBadge={(card) => <span data-testid={`badge-${card.scryfallId}`}>in deck</span>}
        />
      </CardPreviewProvider>,
    );

    const badge = screen.getByTestId('badge-b').closest('[data-badge-index]');
    expect(badge).toHaveAttribute('data-badge-index', '1');
    expect(badge).toHaveClass('left-1');
    expect(badge).not.toHaveClass('bottom-1');
  });
});
