import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatchCard, type MatchCardMatch } from '@/components/MatchCard';
import type { PoolSetInfo } from '@/hooks/useSeasonPoolSets';

const baseMatch: MatchCardMatch = {
  id: 'match-1',
  status: 'pending',
  isBye: false,
  gameResults: [],
  player1: {
    id: 'user-1',
    displayName: 'Alice',
    publicName: null,
    discordHandle: null,
    avatarUrl: null,
  },
  player2: {
    id: 'user-2',
    displayName: 'Bob',
    publicName: null,
    discordHandle: null,
    avatarUrl: null,
  },
};

describe('MatchCard', () => {
  it('shows set symbol for player with pool sets', () => {
    const poolSetsByUserId = new Map<string, PoolSetInfo>([
      ['user-1', { setCodes: ['DMU'], primarySetCode: 'DMU' }],
    ]);

    render(
      <MatchCard
        match={baseMatch}
        eventRecords={new Map()}
        seasonPoints={new Map()}
        poolSetsByUserId={poolSetsByUserId}
      />,
    );

    expect(screen.getByTestId('set-symbol-DMU')).toBeInTheDocument();
    expect(screen.queryAllByTestId('set-symbol-DMU')).toHaveLength(1);
  });

  it('does not show set symbol for player without pool entry', () => {
    const poolSetsByUserId = new Map<string, PoolSetInfo>([
      ['user-1', { setCodes: ['DMU'], primarySetCode: 'DMU' }],
    ]);

    render(
      <MatchCard
        match={baseMatch}
        eventRecords={new Map()}
        seasonPoints={new Map()}
        poolSetsByUserId={poolSetsByUserId}
      />,
    );

    expect(screen.queryByTestId('set-symbol-MKM')).not.toBeInTheDocument();
  });

  it('does not show set symbols on bye matches without map entry', () => {
    render(
      <MatchCard
        match={{ ...baseMatch, isBye: true, player2: null }}
        eventRecords={new Map()}
        seasonPoints={new Map()}
        poolSetsByUserId={new Map()}
      />,
    );

    expect(screen.queryByTestId(/set-symbol-/)).not.toBeInTheDocument();
  });

  it('shows discord handle subtitle when set', () => {
    render(
      <MatchCard
        match={{
          ...baseMatch,
          player1: {
            ...baseMatch.player1,
            discordHandle: 'alice_d',
          },
        }}
        eventRecords={new Map()}
        seasonPoints={new Map()}
      />,
    );

    expect(screen.getByText('alice_d')).toBeInTheDocument();
  });

  it('shows discord subtitle when handle matches display name', () => {
    render(
      <MatchCard
        match={{
          ...baseMatch,
          player1: {
            ...baseMatch.player1,
            displayName: 'Alice',
            discordHandle: 'alice',
          },
        }}
        eventRecords={new Map()}
        seasonPoints={new Map()}
      />,
    );

    expect(screen.getByText('alice')).toBeInTheDocument();
  });
});
