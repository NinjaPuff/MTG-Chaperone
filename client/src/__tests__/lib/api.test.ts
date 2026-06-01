import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, clearStoredToken, setStoredToken } from '../../lib/api';

describe('apiRequest', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('attaches bearer token and returns parsed JSON payload', async () => {
    setStoredToken('token-123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );

    const response = await apiRequest<{ data: { ok: boolean } }>('/api/test', {
      method: 'POST',
      body: { ping: 'pong' },
    });

    expect(response.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-123');
    expect((init?.headers as Headers).get('Content-Type')).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify({ ping: 'pong' }));
  });

  it('clears token and throws ApiError on 401 without redirect by default', async () => {
    setStoredToken('expired-token');
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/join',
        search: '?token=abc',
        assign,
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));

    const thrown = await apiRequest('/api/protected').catch((error) => error as ApiError);
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown.status).toBe(401);
    expect(thrown.code).toBe('UNAUTHORIZED');
    expect(localStorage.getItem('mtg_league_token')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
    clearStoredToken();
  });

  it('redirects to login with returnUrl on 401 when redirectOn401 is enabled', async () => {
    setStoredToken('expired-token');
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/join',
        search: '?token=abc',
        assign,
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));

    await apiRequest('/api/protected', { redirectOn401: true }).catch(() => undefined);

    expect(assign).toHaveBeenCalledWith('/login?returnUrl=%2Fjoin%3Ftoken%3Dabc');
    expect(localStorage.getItem('mtg_league_token')).toBeNull();
  });

  it('does not redirect on 401 when already on login', async () => {
    setStoredToken('expired-token');
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/login',
        search: '',
        assign,
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));

    await apiRequest('/api/protected', { redirectOn401: true }).catch(() => undefined);

    expect(assign).not.toHaveBeenCalled();
  });
});
