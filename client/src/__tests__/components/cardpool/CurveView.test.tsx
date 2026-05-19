import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardPreviewProvider } from '../../../components/cardpool/CardPreviewContext';
import { CurveView } from '../../../components/cardpool/CurveView';
import type { PoolCard } from '../../../components/cardpool/types';

function makeCard(overrides: Partial<PoolCard> = {}): PoolCard {
  return {
    scryfallId: overrides.scryfallId ?? 'card-1',
    name: overrides.name ?? 'Bolt',
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
  it('shows total copy count in the mana bucket label', () => {
    const resizeObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    }));
    vi.stubGlobal('ResizeObserver', resizeObserver);

    render(
      <CardPreviewProvider>
        <CurveView
          cards={[makeCard({ cmc: 1, quantity: 4 })]}
          sortKey="name"
          groupMode="flat"
          organizeBy="cmc"
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.queryByText('(1)')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('shows total copy count beside organize-by group heading', () => {
    const resizeObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    }));
    vi.stubGlobal('ResizeObserver', resizeObserver);

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
        />
      </CardPreviewProvider>,
    );

    expect(screen.getByText(/Creature \(5\)/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
