import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeDeckSharePayload, type DeckSharePayload } from '@mtg-league/shared';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authApiRequest: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  authApiRequest: mocks.authApiRequest,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

import { ShareDeckPage } from '@/pages/ShareDeckPage';

const snapshot: DeckSharePayload = {
  v: 1,
  ownerDisplayName: 'Alice',
  deckName: 'Grixis Mid',
  eventName: 'Week 1',
  roundNumber: 1,
  status: 'draft',
  entries: [
    {
      scryfallId: 'shock-1',
      quantity: 2,
      zone: 'main',
      name: 'Shock',
      layout: 'normal',
      manaCost: '{R}',
      typeLine: 'Instant',
      cmc: 1,
      colorIdentity: ['R'],
    },
    {
      scryfallId: 'negate-1',
      quantity: 1,
      zone: 'sideboard',
      name: 'Negate',
      layout: 'normal',
      manaCost: '{1}{U}',
      typeLine: 'Instant',
      cmc: 2,
      colorIdentity: ['U'],
    },
  ],
};

const encoded = encodeDeckSharePayload(snapshot);

function decklistApiCalls() {
  return [...mocks.apiRequest.mock.calls, ...mocks.authApiRequest.mock.calls].filter((call) =>
    String(call[0]).includes('/api/decklists'),
  );
}

function renderShare(entry: string | { pathname: string; hash?: string; search?: string }) {
  return renderWithAppProviders(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/share/decks/:token" element={<ShareDeckPage />} />
        <Route path="/share/decks" element={<ShareDeckPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ShareDeckPage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.authApiRequest.mockReset();
    mocks.useAuth.mockReturnValue({ user: null });
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path === '/api/cards/shock-1') {
        return {
          data: {
            name: 'Shock',
            layout: 'normal',
            manaCost: '{R}',
            typeLine: 'Instant',
            cmc: 1,
            colorIdentity: ['R'],
            setCode: 'M10',
            collectorNumber: '146',
          },
        };
      }
      if (path === '/api/cards/negate-1') {
        return {
          data: {
            name: 'Negate',
            layout: 'normal',
            manaCost: '{1}{U}',
            typeLine: 'Instant',
            cmc: 2,
            colorIdentity: ['U'],
            setCode: 'M11',
            collectorNumber: '68',
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    document.title = 'MTG Chaperone';
    document.head.querySelectorAll('meta[name="robots"], meta[name="referrer"]').forEach((node) => node.remove());
  });

  afterEach(() => {
    document.title = 'MTG Chaperone';
    document.head.querySelectorAll('meta[name="robots"], meta[name="referrer"]').forEach((node) => node.remove());
  });

  it('renders List by default for a guest and never calls decklist APIs', async () => {
    renderShare({ pathname: '/share/decks', hash: `#${encoded}` });

    await waitFor(() => {
      expect(screen.getByText('Shock')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Main Deck' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sideboard' })).toBeInTheDocument();
    expect(screen.getByText('Negate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Curve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('dialog', { name: 'Export deck' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
    expect(decklistApiCalls()).toEqual([]);
  });

  it('keeps List chrome for a signed-in recipient without live decklist access', async () => {
    mocks.useAuth.mockReturnValue({ user: { id: 'user-bob', role: 'user', displayName: 'Bob' } });
    renderShare({ pathname: '/share/decks', hash: `#${encoded}` });

    await waitFor(() => {
      expect(screen.getByText('Shock')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(decklistApiCalls()).toEqual([]);
  });

  it('opens read-only Details analytics from the List/Details toggle', async () => {
    renderShare({ pathname: '/share/decks', hash: `#${encoded}` });

    await waitFor(() => {
      expect(screen.getByText('Shock')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('button', { name: 'Curve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unregister' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('deck-analytics-enable-editing')).not.toBeInTheDocument();
  });

  it.each([
    [{ pathname: '/share/decks' }, 'missing hash'],
    [{ pathname: '/share/decks', hash: '#' }, 'empty hash'],
    [{ pathname: '/share/decks', hash: '#v1.' }, 'truncated payload'],
    [{ pathname: '/share/decks', hash: '#v1.not-valid' }, 'garbage payload'],
    [{ pathname: '/share/decks', search: '?d=packed' }, 'query string only'],
  ])('shows invalid-link UI for %s', async (entry) => {
    renderShare(entry);

    expect(await screen.findByText('This share link is invalid.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/');
    expect(decklistApiCalls()).toEqual([]);
  });

  it('sets noindex and no-referrer while mounted and restores them on unmount', async () => {
    const { unmount } = renderShare({ pathname: '/share/decks', hash: `#${encoded}` });

    await waitFor(() => {
      expect(screen.getByText('Shock')).toBeInTheDocument();
    });
    expect(document.title).toContain('Grixis Mid');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');

    unmount();
    expect(document.title).toBe('MTG Chaperone');
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.querySelector('meta[name="referrer"]')).toBeNull();
  });

  it('exports printings from a hydrated hash snapshot', async () => {
    renderShare({ pathname: '/share/decks', hash: `#${encoded}` });

    await waitFor(() => {
      expect(screen.getByText('Shock')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('dialog', { name: 'Export deck' })).toBeInTheDocument();
    expect(screen.getByTestId('deck-export-text')).toHaveTextContent('2 Shock (M10) 146');
  });

  it('loads a token snapshot from GET /api/share/decklists/:token and never calls GET /api/decklists/:id', async () => {
    const tokenSnapshot: DeckSharePayload = {
      ...snapshot,
      entries: [
        { ...snapshot.entries[0], setCode: 'M10', collectorNumber: '146' },
        { ...snapshot.entries[1], setCode: 'M11', collectorNumber: '68' },
      ],
    };
    mocks.apiRequest.mockImplementation(async (path: string) => {
      if (path === '/api/share/decklists/tok_test') {
        return { data: tokenSnapshot };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderShare('/share/decks/tok_test');

    await waitFor(() => {
      expect(screen.getByText('Shock')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Grixis Mid' })).toBeInTheDocument();
    expect(mocks.apiRequest).toHaveBeenCalledWith('/api/share/decklists/tok_test');
    expect(mocks.apiRequest.mock.calls.some((call) => String(call[0]).includes('/api/cards/'))).toBe(
      false,
    );
    expect(decklistApiCalls()).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('dialog', { name: 'Export deck' })).toBeInTheDocument();
    expect(screen.getByTestId('deck-export-text')).toHaveTextContent('2 Shock (M10) 146');
  });
});
