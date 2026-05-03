import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, clearStoredToken, setStoredToken } from '../../lib/api';

describe('apiRequest', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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

  it('clears token and throws ApiError on 401', async () => {
    setStoredToken('expired-token');
    window.history.pushState({}, '', '/login');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));

    const thrown = await apiRequest('/api/protected').catch((error) => error as ApiError);
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown.status).toBe(401);
    expect(thrown.code).toBe('UNAUTHORIZED');
    expect(localStorage.getItem('mtg_league_token')).toBeNull();
    clearStoredToken();
  });
});
