const TOKEN_STORAGE_KEY = 'mtg_league_token';

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, payload: ApiErrorPayload['error']) {
    super(payload.message);
    this.code = payload.code;
    this.status = status;
    this.fields = payload.fields;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export async function apiRequest<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (response.status === 401) {
    clearStoredToken();
    if (!window.location.pathname.startsWith('/login')) {
      const returnUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.assign(`/login?returnUrl=${returnUrl}`);
    }
    throw new ApiError(401, { code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  if (!response.ok) {
    const fallback = { code: 'REQUEST_FAILED', message: 'Request failed' };
    let payload: ApiErrorPayload['error'] = fallback;
    try {
      const json = (await response.json()) as ApiErrorPayload;
      payload = json.error ?? fallback;
    } catch {
      payload = fallback;
    }
    throw new ApiError(response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

