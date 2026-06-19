import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BracketMatchNode } from '@/components/bracket/BracketMatchNode';

describe('BracketMatchNode', () => {
  it('renders names, status, and score for completed matches', () => {
    render(
      <BracketMatchNode
        slot={{
          slotKey: 'W1',
          bracketSide: 'winners',
          bracketRound: 1,
          row: 1,
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
        }}
        matchLabel="Match 1"
        participants={[
          { label: 'Alice', userId: 'u1', avatarUrl: 'https://example.com/alice.png', isPlaceholder: false },
          { label: 'Bob', userId: 'u2', avatarUrl: null, isPlaceholder: false },
        ]}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(document.querySelector('img[src="https://example.com/alice.png"]')).toBeTruthy();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('2-1')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
    expect(screen.getByText('Match 1')).toBeInTheDocument();
  });

  it('renders placeholder participants distinctly from confirmed names', () => {
    render(
      <BracketMatchNode
        slot={{
          slotKey: 'W3',
          bracketSide: 'winners',
          bracketRound: 2,
          row: 1,
          winnerId: null,
          match: null,
        }}
        matchLabel="Match 1"
        participants={[
          { label: 'Scott', userId: 'u1', isPlaceholder: false },
          { label: 'Winner · Match 1', isPlaceholder: true },
        ]}
      />,
    );

    expect(screen.getByText('Scott')).toBeInTheDocument();
    expect(screen.getByText('Winner · Match 1')).toBeInTheDocument();
  });

  it('renders reported matches as non-interactive when no click handler is provided', () => {
    render(
      <BracketMatchNode
        slot={{
          slotKey: 'W1',
          bracketSide: 'winners',
          bracketRound: 1,
          row: 1,
          winnerId: null,
          match: {
            id: 'm1',
            status: 'reported',
            gameResults: [{ winnerId: 'u1', isDraw: false }],
          },
        }}
        matchLabel="Match 1"
        participants={[
          { label: 'Alice', userId: 'u1', isPlaceholder: false },
          { label: 'Bob', userId: 'u2', isPlaceholder: false },
        ]}
      />,
    );

    expect(screen.getByTestId('bracket-node-W1')).toBeDisabled();
  });
});
