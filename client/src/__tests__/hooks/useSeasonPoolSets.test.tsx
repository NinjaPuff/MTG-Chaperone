import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
}));

import { useSeasonPoolSets } from '@/hooks/useSeasonPoolSets';

function Probe({
  leagueSlug,
  seasonNumber,
}: {
  leagueSlug: string | null;
  seasonNumber: number | null;
}) {
  const { poolSetsByUserId, isLoading, error } = useSeasonPoolSets(leagueSlug, seasonNumber);
  const info = poolSetsByUserId.get('user-1');
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? 'none'}</span>
      <span data-testid="codes">{info ? info.setCodes.join(',') : 'missing'}</span>
      <span data-testid="primary">{info?.primarySetCode ?? 'missing'}</span>
      <span data-testid="empty-pool">
        {poolSetsByUserId.has('user-2') ? poolSetsByUserId.get('user-2')!.setCodes.join(',') : 'missing'}
      </span>
    </div>
  );
}

describe('useSeasonPoolSets', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('skips fetch when league or season is missing', () => {
    render(<Probe leagueSlug={null} seasonNumber={1} />);
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('builds deduped set codes per user with explicit primary', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: [
        {
          user: { id: 'user-1' },
          boosterProduct: {
            primarySetCode: 'STX',
            setCodes: [
              { id: '1', setCode: 'dmu' },
              { id: '2', setCode: 'STX' },
              { id: '3', setCode: 'dmu' },
            ],
          },
        },
        {
          user: { id: 'user-2' },
          boosterProduct: { primarySetCode: null, setCodes: [] },
        },
      ],
    });

    render(<Probe leagueSlug="league" seasonNumber={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('codes').textContent).toBe('DMU,STX');
    expect(screen.getByTestId('primary').textContent).toBe('STX');
    expect(screen.getByTestId('empty-pool').textContent).toBe('');
    expect(mocks.apiRequest).toHaveBeenCalledWith('/api/leagues/league/seasons/1/pools');
  });

  it('resolves primary from sorted first when API primary is null', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: [
        {
          user: { id: 'user-1' },
          boosterProduct: {
            primarySetCode: null,
            setCodes: [
              { id: '1', setCode: 'STX' },
              { id: '2', setCode: 'SNC' },
            ],
          },
        },
      ],
    });

    render(<Probe leagueSlug="league" seasonNumber={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('primary').textContent).toBe('SNC');
    });
  });

  it('clears map on error', async () => {
    mocks.apiRequest.mockRejectedValue(new Error('fail'));

    render(<Probe leagueSlug="league" seasonNumber={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('fail');
    });

    expect(screen.getByTestId('codes').textContent).toBe('missing');
  });
});
