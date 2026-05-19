import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardPreviewProvider } from '../../../components/cardpool/CardPreviewContext';
import { ListView } from '../../../components/cardpool/ListView';
import type { PoolCard } from '../../../components/cardpool/types';

function makeCard(overrides: Partial<PoolCard> = {}): PoolCard {
  return {
    scryfallId: overrides.scryfallId ?? 'card-1',
    name: overrides.name ?? 'Lightning Bolt',
    manaCost: overrides.manaCost ?? '{R}',
    typeLine: overrides.typeLine ?? 'Instant',
    rarity: overrides.rarity ?? 'common',
    setCode: overrides.setCode ?? 'TST',
    imageUris: overrides.imageUris ?? null,
    cmc: overrides.cmc ?? 1,
    colors: overrides.colors ?? ['R'],
    colorIdentity: overrides.colorIdentity ?? ['R'],
    quantity: overrides.quantity ?? 1,
    phaseLabel: overrides.phaseLabel ?? 'Initial Pool',
    phaseQuantities: overrides.phaseQuantities ?? { 'Initial Pool': 1 },
  };
}

function renderListView(props: Partial<Parameters<typeof ListView>[0]> = {}) {
  const card = makeCard();
  return render(
    <CardPreviewProvider>
      <ListView
        cards={[card]}
        sortKey="name"
        groupMode="flat"
        organizeBy="type"
        {...props}
      />
    </CardPreviewProvider>,
  );
}

describe('ListView', () => {
  it('calls onCardClick once when a card row is clicked', () => {
    const card = makeCard();
    const onCardClick = vi.fn();
    renderListView({ cards: [card], onCardClick });

    fireEvent.click(screen.getByText('Lightning Bolt'));

    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).toHaveBeenCalledWith(card);
  });

  it('does not call onCardClick when only onCardDoubleClick is wired and user single-clicks', () => {
    const onCardDoubleClick = vi.fn();
    renderListView({ onCardDoubleClick });

    fireEvent.click(screen.getByText('Lightning Bolt'));

    expect(onCardDoubleClick).not.toHaveBeenCalled();
  });
});
