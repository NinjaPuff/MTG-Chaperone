import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BracketView } from '@/components/bracket/BracketView';

const baseSlots = [
  {
    id: 'slot-w1',
    slotKey: 'W1',
    bracketSide: 'winners',
    bracketRound: 1,
    col: 1,
    row: 1,
    player1: { id: 'u1', displayName: 'Alice', publicName: null, slug: 'alice', avatarUrl: null },
    player2: { id: 'u2', displayName: 'Bob', publicName: null, slug: 'bob', avatarUrl: null },
    winnerId: 'u1',
    match: {
      id: 'm1',
      status: 'confirmed',
      gameResults: [
        { id: 'g1', winnerId: 'u1', isDraw: false },
        { id: 'g2', winnerId: 'u2', isDraw: false },
        { id: 'g3', winnerId: 'u1', isDraw: false },
      ],
    },
    source1: { type: 'seed', seedNum: 1 },
    source2: { type: 'seed', seedNum: 2 },
  },
  {
    id: 'slot-w2',
    slotKey: 'W2',
    bracketSide: 'winners',
    bracketRound: 1,
    col: 1,
    row: 2,
    player1: null,
    player2: null,
    winnerId: null,
    match: null,
    source1: { type: 'seed', seedNum: 3 },
    source2: { type: 'seed', seedNum: 4 },
  },
  {
    id: 'slot-w3',
    slotKey: 'W3',
    bracketSide: 'winners',
    bracketRound: 2,
    col: 2,
    row: 1,
    player1: { id: 'u1', displayName: 'Alice', publicName: null, slug: 'alice', avatarUrl: null },
    player2: null,
    winnerId: null,
    match: null,
    source1: { type: 'match', slotKey: 'W1', takes: 'winner' },
    source2: { type: 'match', slotKey: 'W2', takes: 'winner' },
  },
] as const;

describe('BracketView', () => {
  it('renders one node per slot', () => {
    render(<BracketView slots={[...baseSlots]} />);

    expect(screen.getByTestId('bracket-node-W1')).toBeInTheDocument();
    expect(screen.getByTestId('bracket-node-W2')).toBeInTheDocument();
    expect(screen.getByTestId('bracket-node-W3')).toBeInTheDocument();
  });

  it('renders connector paths between match-derived dependencies', () => {
    render(<BracketView slots={[...baseSlots]} />);

    const connectors = screen.getAllByTestId('bracket-connector');
    expect(connectors.length).toBeGreaterThan(0);
  });

  it('shows both participant rows with descriptive placeholders for unresolved slots', () => {
    render(<BracketView slots={[...baseSlots]} />);

    expect(screen.getByText('Seed 3')).toBeInTheDocument();
    expect(screen.getByText('Seed 4')).toBeInTheDocument();
    expect(screen.getByText('Winner · Match 2')).toBeInTheDocument();
  });

  it('emits onMatchClick when a clickable node is clicked', () => {
    const onMatchClick = vi.fn();
    render(
      <BracketView
        slots={[...baseSlots]}
        onMatchClick={onMatchClick}
        isMatchClickable={(matchId) => matchId === 'm1'}
      />,
    );

    fireEvent.click(screen.getByTestId('bracket-node-W1'));

    expect(onMatchClick).toHaveBeenCalledWith('m1');
  });

  it('does not emit onMatchClick for non-clickable matches', () => {
    const onMatchClick = vi.fn();
    render(
      <BracketView
        slots={[...baseSlots]}
        onMatchClick={onMatchClick}
        isMatchClickable={() => false}
      />,
    );

    fireEvent.click(screen.getByTestId('bracket-node-W1'));

    expect(onMatchClick).not.toHaveBeenCalled();
  });
});
