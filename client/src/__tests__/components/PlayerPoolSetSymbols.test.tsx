import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerPoolSetSymbols } from '@/components/PlayerPoolSetSymbols';
import type { PoolSetInfo } from '@/hooks/useSeasonPoolSets';

describe('PlayerPoolSetSymbols', () => {
  it('shows only the primary set symbol when primaryOnly is true', () => {
    const poolSetsByUserId = new Map<string, PoolSetInfo>([
      ['user-1', { setCodes: ['SNC', 'STX'], primarySetCode: 'STX' }],
    ]);

    render(
      <PlayerPoolSetSymbols
        userId="user-1"
        poolSetsByUserId={poolSetsByUserId}
      />,
    );

    expect(screen.getByTestId('set-symbol-STX')).toBeInTheDocument();
    expect(screen.queryByTestId('set-symbol-SNC')).not.toBeInTheDocument();
  });

  it('renders nothing when user is missing from map', () => {
    render(
      <PlayerPoolSetSymbols
        userId="user-1"
        poolSetsByUserId={new Map()}
      />,
    );

    expect(screen.queryByTestId(/set-symbol-/)).not.toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    const poolSetsByUserId = new Map<string, PoolSetInfo>([
      ['user-1', { setCodes: ['DMU'], primarySetCode: 'DMU' }],
    ]);

    render(
      <PlayerPoolSetSymbols
        userId="user-1"
        poolSetsByUserId={poolSetsByUserId}
        poolSetsLoading
      />,
    );

    expect(screen.queryByTestId(/set-symbol-/)).not.toBeInTheDocument();
  });
});
