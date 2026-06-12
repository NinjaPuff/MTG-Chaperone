import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PoolCardBadge } from '@/components/deckbuilder/PoolCardBadge';

describe('PoolCardBadge', () => {
  it('shows green in-deck badge only for active deck copies', () => {
    render(<PoolCardBadge allocated={2} allocatedInActiveDeck={2} restricted={0} />);
    expect(screen.getByText('in deck 2')).toBeInTheDocument();
    expect(screen.queryByText(/other decks/)).not.toBeInTheDocument();
  });

  it('shows other-decks badge when copies are only in non-active decks', () => {
    render(<PoolCardBadge allocated={2} allocatedInActiveDeck={0} restricted={0} />);
    expect(screen.queryByText(/in deck/)).not.toBeInTheDocument();
    expect(screen.getByText('other decks 2')).toBeInTheDocument();
  });

  it('shows both badges when copies are split across active and other decks', () => {
    render(<PoolCardBadge allocated={3} allocatedInActiveDeck={1} restricted={0} />);
    expect(screen.getByText('in deck 1')).toBeInTheDocument();
    expect(screen.getByText('other decks 2')).toBeInTheDocument();
  });
});
