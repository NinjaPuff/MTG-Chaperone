import { fireEvent, screen } from '@testing-library/react';
import { useRef, type RefObject } from 'react';
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

function mockResizeObserver(width = 800) {
  global.ResizeObserver = class {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      const entry = {
        target,
        contentRect: {
          width,
          height: 600,
          top: 0,
          left: 0,
          bottom: 600,
          right: width,
          x: 0,
          y: 0,
        },
      } as unknown as ResizeObserverEntry;
      this.callback([entry], this as unknown as ResizeObserver);
    }

    unobserve() {}

    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

function renderGridView(
  props: Omit<React.ComponentProps<typeof GridView>, 'scrollElementRef'>,
) {
  function ScrollHost() {
    const scrollRef = useRef<HTMLDivElement>(null);
    return (
      <div ref={scrollRef} style={{ height: 800, overflow: 'auto' }} data-testid="grid-scroll-host">
        <GridView {...props} scrollElementRef={scrollRef as RefObject<HTMLElement | null>} />
      </div>
    );
  }

  return renderWithAppProviders(<ScrollHost />);
}

describe('GridView', () => {
  beforeEach(() => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    mockResizeObserver(800);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 800;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return 5000;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  afterEach(() => {
    restoreMatchMedia();
    delete (global as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    vi.restoreAllMocks();
  });

  it('wires getTouchActions to touch action handlers', () => {
    const onAdd = vi.fn();
    renderGridView({
      cards,
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
      getTouchActions: () => [{ label: 'Add to main deck', onAction: onAdd }],
    });

    fireEvent.click(screen.getByRole('img', { name: 'Lightning Bolt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to main deck' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders cards without touch actions', () => {
    renderGridView({
      cards,
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
    });

    expect(screen.getByRole('img', { name: 'Lightning Bolt' })).toBeInTheDocument();
  });

  it('should_anchor_pool_badge_at_top_left_when_renderBadge_provided', () => {
    renderGridView({
      cards,
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
      renderBadge: () => <span>in deck 1</span>,
    });

    const anchor = screen.getByTestId('pool-card-badge-anchor');
    expect(anchor).toHaveClass('top-1', 'left-1');
    expect(anchor).not.toHaveClass('bottom-1');
  });

  it('should_apply_virtual_grid_layout', () => {
    renderGridView({
      cards,
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
    });

    const outerContainer = screen.getByTestId('virtual-grid-container');
    expect(outerContainer).toHaveClass('relative');
    expect(screen.getAllByTestId('virtual-grid-row').length).toBeGreaterThan(0);
  });

  it('should_apply_column_grid_template_from_cardWidth', () => {
    renderGridView({
      cards,
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
    });

    const cardRow = screen.getByTestId('virtual-grid-card-row');
    expect(cardRow).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
  });

  it('should_rotate_split_cards_in_grid', () => {
    renderGridView({
      cards: [
        {
          ...cards[0],
          scryfallId: 'split-1',
          name: 'Fire // Ice',
          layout: 'split',
        },
      ],
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
    });

    expect(screen.getByRole('img', { name: 'Fire // Ice' })).toHaveClass('rotate-90', 'object-contain');
  });

  it('should_use_landscape_aspect_for_siege_battle_cards', () => {
    renderGridView({
      cards: [
        {
          ...cards[0],
          scryfallId: 'siege-1',
          name: 'Invasion of Ikoria // Zilortha, Apex of Ikoria',
          layout: 'transform',
          typeLine: 'Battle — Siege // Legendary Creature — Dinosaur',
        },
      ],
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
    });

    expect(
      screen.getByRole('img', { name: 'Invasion of Ikoria // Zilortha, Apex of Ikoria' }),
    ).toHaveClass('rotate-90', 'object-contain');
  });

  it('should_rotate_room_cards_in_grid', () => {
    renderGridView({
      cards: [
        {
          ...cards[0],
          scryfallId: 'room-1',
          name: "Dollmaker's Shop // Porcelain Gallery",
          layout: 'split',
          typeLine: 'Enchantment — Room',
        },
      ],
      sortKey: 'name',
      groupMode: 'flat',
      organizeBy: 'type',
      cardWidth: 200,
    });

    expect(
      screen.getByRole('img', { name: "Dollmaker's Shop // Porcelain Gallery" }),
    ).toHaveClass('rotate-90', 'object-contain');
  });
});
