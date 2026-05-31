import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  clearStoredToken: vi.fn(),
  getStoredToken: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  clearStoredToken: mocks.clearStoredToken,
  getStoredToken: mocks.getStoredToken,
}));

import { AuthProvider, useAuth } from '@/context/AuthContext';

function Probe() {
  const { user, isLoading, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user?.id ?? 'none'}</div>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.clearStoredToken.mockReset();
    mocks.getStoredToken.mockReset();
  });

  it('loads authenticated user when token exists', async () => {
    mocks.getStoredToken.mockReturnValue('token-1');
    mocks.apiRequest.mockResolvedValue({
      data: {
        id: 'user-1',
        displayName: 'User',
        publicName: null,
        discordHandle: null,
        authProvider: 'google',
        slug: 'user',
        avatarUrl: null,
        role: 'user',
      },
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('user-1');
    expect(mocks.apiRequest).toHaveBeenCalledWith('/api/auth/me');
  });

  it('clears user on logout', async () => {
    mocks.getStoredToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(mocks.apiRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(mocks.clearStoredToken).toHaveBeenCalled();
  });
});
