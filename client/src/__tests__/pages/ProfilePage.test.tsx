import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  refreshUser: vi.fn(),
  useAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(status: number, payload: { code: string; message: string }) {
      super(payload.message);
      this.code = payload.code;
      this.status = status;
    }
  },
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  ApiError: mocks.ApiError,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

import { ProfilePage } from '@/pages/ProfilePage';

const googleUser = {
  id: 'user-1',
  displayName: 'Google Name',
  publicName: null,
  discordHandle: null,
  authProvider: 'google' as const,
  slug: 'google-name',
  avatarUrl: null,
  role: 'user' as const,
};

const discordUser = {
  id: 'user-2',
  displayName: 'discord_user',
  publicName: null,
  discordHandle: 'discord_user',
  authProvider: 'discord' as const,
  slug: 'discord-user',
  avatarUrl: null,
  role: 'user' as const,
};

describe('ProfilePage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.refreshUser.mockReset();
    mocks.refreshUser.mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({
      user: googleUser,
      isLoading: false,
      refreshUser: mocks.refreshUser,
    });
  });

  it('shows editable fields by default and hides synced account details until expanded', () => {
    render(<ProfilePage />);

    expect(screen.getByLabelText(/Public Display Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Discord Handle/)).toBeEnabled();
    expect(screen.queryByLabelText(/Account Name/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show synced account details' }));

    expect(screen.getByLabelText(/Account Name/)).toBeDisabled();
    expect(screen.getByLabelText(/Account Name/)).toHaveValue('Google Name');
    expect(screen.queryByLabelText(/Discord Username/)).not.toBeInTheDocument();
  });

  it('shows discord username as read-only only for discord sign-in users when expanded', () => {
    mocks.useAuth.mockReturnValue({
      user: discordUser,
      isLoading: false,
      refreshUser: mocks.refreshUser,
    });

    render(<ProfilePage />);

    expect(screen.queryByLabelText(/Discord Handle/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show synced account details' }));
    expect(screen.getByLabelText(/Discord Username/)).toBeDisabled();
    expect(screen.getByLabelText(/Discord Username/)).toHaveValue('discord_user');
  });

  it('submits publicName and discordHandle for google users', async () => {
    mocks.apiRequest.mockResolvedValue({ data: googleUser });

    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText(/Discord Handle/), { target: { value: 'my_handle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith('/api/users/profile', {
        method: 'PATCH',
        body: {
          publicName: null,
          discordHandle: 'my_handle',
        },
      });
    });
    expect(mocks.refreshUser).toHaveBeenCalled();
    expect(screen.getByText('Profile updated.')).toBeInTheDocument();
  });

  it('submits only publicName for discord users', async () => {
    mocks.useAuth.mockReturnValue({
      user: discordUser,
      isLoading: false,
      refreshUser: mocks.refreshUser,
    });
    mocks.apiRequest.mockResolvedValue({ data: discordUser });

    render(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith('/api/users/profile', {
        method: 'PATCH',
        body: {
          publicName: null,
        },
      });
    });
  });

  it('shows API validation errors', async () => {
    mocks.apiRequest.mockRejectedValue(new mocks.ApiError(400, { code: 'VALIDATION_ERROR', message: 'Invalid discord handle' }));

    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText(/Discord Handle/), { target: { value: 'bad!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid discord handle')).toBeInTheDocument();
    });
    expect(screen.queryByText('Profile updated.')).not.toBeInTheDocument();
  });

  it('does not duplicate subtitle when discord handle matches account name', () => {
    mocks.useAuth.mockReturnValue({
      user: { ...googleUser, displayName: 'same', discordHandle: 'same' },
      isLoading: false,
      refreshUser: mocks.refreshUser,
    });

    render(<ProfilePage />);

    expect(screen.getAllByText('same')).toHaveLength(1);
  });
});
