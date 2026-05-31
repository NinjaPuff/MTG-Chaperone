import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RETURN_URL_STORAGE_KEY } from '@/lib/returnUrl';

const mocks = vi.hoisted(() => ({
  refreshUser: vi.fn(),
  navigate: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  setStoredToken: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: mocks.refreshUser,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [mocks.searchParams, vi.fn()],
  };
});

import { AuthCallbackPage } from '@/pages/AuthCallbackPage';

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.refreshUser.mockReset();
    mocks.navigate.mockReset();
    mocks.searchParams = new URLSearchParams();
    mocks.refreshUser.mockResolvedValue(undefined);
  });

  it('redirects to stored returnUrl after successful sign-in', async () => {
    sessionStorage.setItem(RETURN_URL_STORAGE_KEY, '/join?token=abc');
    mocks.searchParams = new URLSearchParams('token=callback-jwt');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/join?token=abc', { replace: true });
    });
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
  });

  it('falls back to home when no stored returnUrl exists', async () => {
    mocks.searchParams = new URLSearchParams('token=callback-jwt');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows an error when callback token is missing', async () => {
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText('Missing token from OAuth callback.')).toBeInTheDocument();
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows an error and preserves stored returnUrl when refreshUser fails', async () => {
    sessionStorage.setItem(RETURN_URL_STORAGE_KEY, '/join?token=abc');
    mocks.searchParams = new URLSearchParams('token=callback-jwt');
    mocks.refreshUser.mockRejectedValue(new Error('refresh failed'));

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to complete sign-in.')).toBeInTheDocument();
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe('/join?token=abc');
  });
});
