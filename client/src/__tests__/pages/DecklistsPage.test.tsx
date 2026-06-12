import { screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'user' },
  }),
}));

vi.mock('@/hooks/useCurrentLeague', () => ({
  useCurrentLeague: () => ({
    activeSeasonId: 'season-1',
    isLoading: false,
  }),
}));

import { DecklistsPage } from '@/pages/DecklistsPage';

function renderPage() {
  renderWithAppProviders(
    <MemoryRouter>
      <DecklistsPage />
    </MemoryRouter>,
  );
}

describe('DecklistsPage previous deck grouping', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('groups completed decks by event and orders groups by most recent event first', async () => {
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path === '/api/seasons/season-1/events') {
        return {
          data: [
            { id: 'event-active', name: 'Current Event', status: 'active', orderIndex: 5 },
            { id: 'event-2', name: 'Week 2', status: 'completed', orderIndex: 2 },
            { id: 'event-1', name: 'Week 1', status: 'completed', orderIndex: 1 },
          ],
        };
      }
      if (path === '/api/decklists/my-season/season-1') {
        return {
          data: [
            {
              id: 'deck-2a',
              orderIndex: 0,
              name: 'Tempo',
              status: 'submitted',
              event: { id: 'event-2', name: 'Week 2', status: 'completed', orderIndex: 2 },
              round: { id: 'r2', roundNumber: 2, status: 'completed' },
              entries: [
                { id: 'e1', quantity: 2, zone: 'main', cachedCard: { name: 'Card A', manaCost: null } },
              ],
            },
            {
              id: 'deck-1a',
              orderIndex: 0,
              name: 'Control',
              status: 'submitted',
              event: { id: 'event-1', name: 'Week 1', status: 'completed', orderIndex: 1 },
              round: { id: 'r1', roundNumber: 1, status: 'completed' },
              entries: [
                { id: 'e2', quantity: 3, zone: 'main', cachedCard: { name: 'Card B', manaCost: null } },
              ],
            },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Week 2')).toBeInTheDocument();
      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    const section = screen.getByRole('heading', { name: 'Previous Decklists This Season' }).closest('div');
    expect(section).toBeTruthy();

    const groups = within(section as HTMLElement).getAllByRole('heading', { level: 3 });
    expect(groups.map((node) => node.textContent)).toEqual(['Week 2', 'Week 1']);
    expect(within(section as HTMLElement).getByText(/Tempo - Round 2/)).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText(/Control - Round 1/)).toBeInTheDocument();
  });

  it('shows empty state when there are no completed-event decks', async () => {
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path === '/api/seasons/season-1/events') {
        return {
          data: [{ id: 'event-active', name: 'Current Event', status: 'active', orderIndex: 5 }],
        };
      }
      if (path === '/api/decklists/my-season/season-1') {
        return {
          data: [
            {
              id: 'deck-active',
              orderIndex: 0,
              name: 'Current Deck',
              status: 'draft',
              event: { id: 'event-active', name: 'Current Event', status: 'active', orderIndex: 5 },
              round: { id: 'r1', roundNumber: 1, status: 'not_started' },
              entries: [],
            },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No previous decklists yet.')).toBeInTheDocument();
    });
  });
});

