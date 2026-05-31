import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
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

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

import { JoinPage } from '@/pages/JoinPage';

const invitePreview = {
  token: 'invite-token',
  league: {
    name: 'Test League',
    slug: 'test-league',
    description: null,
  },
  expiresAt: null,
  maxUses: null,
  useCount: 0,
};

describe('JoinPage', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({ data: invitePreview });
    mocks.useAuth.mockReturnValue({ user: null });
  });

  it('sign-in link preserves invite token in returnUrl', async () => {
    render(
      <MemoryRouter initialEntries={['/join?token=invite-token']}>
        <JoinPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign In to Join' })).toBeInTheDocument();
    });

    const signInLink = screen.getByRole('link', { name: 'Sign In to Join' });
    expect(signInLink.getAttribute('href')).toContain('returnUrl=%2Fjoin%3Ftoken%3Dinvite-token');
  });

  it('shows join button when authenticated', async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: 'user-1',
        displayName: 'User',
        role: 'user',
      },
    });

    render(
      <MemoryRouter initialEntries={['/join?token=invite-token']}>
        <JoinPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Join League' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'Sign In to Join' })).toBeNull();
  });
});
