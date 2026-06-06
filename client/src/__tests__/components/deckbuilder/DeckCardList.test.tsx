import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckCardList, type DeckCardListItem } from '../../../components/deckbuilder/DeckCardList';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

function makeListItem(overrides: Partial<DeckCardListItem> = {}): DeckCardListItem {
  return {
    cachedCardId: overrides.cachedCardId ?? 'card-1',
    name: overrides.name ?? 'Test Card',
    layout: overrides.layout ?? null,
    manaCost: overrides.manaCost ?? '{1}',
    typeLine: overrides.typeLine ?? 'Creature',
    quantity: overrides.quantity ?? 1,
    zone: overrides.zone ?? 'main',
    colorIdentity: overrides.colorIdentity ?? [],
    ...overrides,
  };
}

describe('DeckCardList', () => {
  it('shows total quantity beside group heading', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({ cachedCardId: 'c1', name: 'Grizzly Bears', typeLine: 'Creature — Bear', quantity: 2 }),
          makeListItem({ cachedCardId: 'c2', name: 'Llanowar Elves', typeLine: 'Creature — Elf', quantity: 3 }),
        ]}
      />,
    );

    expect(screen.getByText(/Creature \(5\)/)).toBeInTheDocument();
  });

  it('orders groups by CARD_TYPE_ORDER', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({ cachedCardId: 'i1', name: 'Lightning Bolt', typeLine: 'Instant', quantity: 1 }),
          makeListItem({ cachedCardId: 'c1', name: 'Grizzly Bears', typeLine: 'Creature — Bear', quantity: 1 }),
        ]}
      />,
    );

    const creature = screen.getByText(/Creature \(1\)/);
    const instant = screen.getByText(/Instant \(1\)/);
    expect(creature.compareDocumentPosition(instant) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows empty text and no group headings when deck is empty', () => {
    renderWithAppProviders(<DeckCardList title="Main Deck" emptyText="Drop cards here." cards={[]} />);

    expect(screen.getByText('Drop cards here.')).toBeInTheDocument();
    expect(screen.queryByText(/Creature \(/)).not.toBeInTheDocument();
  });

  it('shows group counts for sideboard cards', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Cards"
        emptyText="Empty sideboard"
        cards={[
          makeListItem({
            cachedCardId: 's1',
            name: 'Negate',
            typeLine: 'Instant',
            quantity: 2,
            zone: 'sideboard',
          }),
        ]}
      />,
    );

    expect(screen.getByText(/Instant \(2\)/)).toBeInTheDocument();
  });

  it('applies red tint class for mono-red rows', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 'r1',
            name: 'Lightning Bolt',
            typeLine: 'Instant',
            quantity: 4,
            colorIdentity: ['R'],
          }),
        ]}
      />,
    );

    const row = screen.getByRole('button', { name: /4x Lightning Bolt/i });
    expect(row.className).toContain('deck-row-tint-red');
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
  });

  it('applies gold tint class for multicolor rows', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 'm1',
            name: 'Augur of Bolas',
            typeLine: 'Creature',
            quantity: 1,
            colorIdentity: ['W', 'U'],
          }),
        ]}
      />,
    );

    const row = screen.getByRole('button', { name: /1x Augur of Bolas/i });
    expect(row.className).toContain('deck-row-tint-gold');
  });

  it('shows warning icon when card has save issue', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 'warn-1',
            name: 'Problem Card',
            typeLine: 'Creature',
            quantity: 1,
            hasSaveIssue: true,
          }),
        ]}
      />,
    );

    expect(screen.getByTitle('Save blocked by this card')).toBeInTheDocument();
  });

  it('should_call_onCardContextMenu_when_row_receives_contextmenu', () => {
    const onCardContextMenu = vi.fn();
    const card = makeListItem({ cachedCardId: 'c1', name: 'Grizzly Bears' });

    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[card]}
        onCardContextMenu={onCardContextMenu}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /1x Grizzly Bears/i }));
    expect(onCardContextMenu).toHaveBeenCalledTimes(1);
    expect(onCardContextMenu.mock.calls[0][1]).toEqual(card);
  });

  it('should_show_front_face_name_only_when_card_has_prepare_layout', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 'p1',
            name: 'Joined Researchers // Secret Rendition',
            layout: 'prepare',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Joined Researchers')).toBeInTheDocument();
    expect(screen.queryByText('Secret Rendition')).not.toBeInTheDocument();
  });

  it('should_show_front_face_name_only_when_card_has_adventure_layout', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 'a1',
            name: 'Bonecrusher Giant // Stomp',
            layout: 'adventure',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Bonecrusher Giant')).toBeInTheDocument();
    expect(screen.queryByText('Stomp')).not.toBeInTheDocument();
  });

  it('should_show_full_name_when_card_has_transform_layout', () => {
    const fullName = 'Delver of Secrets // Insectile Aberration';
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 't1',
            name: fullName,
            layout: 'transform',
          }),
        ]}
      />,
    );

    expect(screen.getByText(fullName)).toBeInTheDocument();
  });

  it('should_show_full_name_when_card_has_null_layout', () => {
    const fullName = 'X // Y';
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 'n1',
            name: fullName,
            layout: null,
          }),
        ]}
      />,
    );

    expect(screen.getByText(fullName)).toBeInTheDocument();
  });

  it('should_show_front_face_mana_cost_only_when_card_has_prepare_layout', () => {
    renderWithAppProviders(
      <DeckCardList
        title="Main Deck"
        emptyText="Empty"
        cards={[
          makeListItem({
            cachedCardId: 'pm1',
            name: 'Joined Researchers // Secret Rendition',
            layout: 'prepare',
            manaCost: '{3}{U} // {1}{U}{U}',
          }),
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'U' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '1' })).not.toBeInTheDocument();
  });
});
