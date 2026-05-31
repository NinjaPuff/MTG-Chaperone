import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
}));

vi.mock('@/hooks/useCurrentLeague', () => ({
  useCurrentLeague: () => ({
    league: { slug: 'test-league' },
    activeSeason: { number: 1 },
    activeSeasonId: 'season-1',
    isLoading: false,
  }),
}));

import { StandingsPage } from '@/pages/StandingsPage';

describe('StandingsPage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path.includes('/standings')) {
        return {
          data: [
            {
              id: 'standing-1',
              points: 9,
              matchWins: 3,
              matchLosses: 0,
              matchDraws: 0,
              omwPercent: 0.5,
              gwPercent: 0.6,
              ogwPercent: 0.55,
              user: {
                id: 'user-1',
                displayName: 'Alice',
                publicName: null,
                discordHandle: 'league_player',
                slug: 'alice',
              },
            },
            {
              id: 'standing-2',
              points: 6,
              matchWins: 2,
              matchLosses: 1,
              matchDraws: 0,
              omwPercent: 0.45,
              gwPercent: 0.5,
              ogwPercent: 0.48,
              user: {
                id: 'user-2',
                displayName: 'Bob',
                publicName: null,
                slug: 'bob',
              },
            },
          ],
        };
      }

      if (path.includes('/pools')) {
        return {
          data: [
            {
              user: { id: 'user-1' },
              boosterProduct: {
                primarySetCode: 'DMU',
                setCodes: [{ id: '1', setCode: 'DMU' }],
              },
            },
          ],
        };
      }

      if (path === '/api/sets') {
        return {
          data: [{ code: 'dmu', name: 'Dominaria United', icon_svg_uri: 'https://svgs.scryfall.io/sets/dmu.svg' }],
        };
      }

      return { data: [] };
    });
  });

  it('shows pool set symbol only for players with pools', async () => {
    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    expect(screen.getByTestId('set-symbol-DMU')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('league_player')).toBeInTheDocument();
    expect(screen.queryAllByTestId('set-symbol-DMU')).toHaveLength(1);
  });
});
