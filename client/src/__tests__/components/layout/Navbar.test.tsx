import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useTheme: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => mocks.useTheme(),
}));

import { Navbar } from '@/components/layout/Navbar';

const baseUser = {
  id: 'user-1',
  displayName: 'User',
  publicName: null,
  slug: 'user',
  avatarUrl: null,
};

describe('Navbar', () => {
  beforeEach(() => {
    mocks.useAuth.mockReset();
    mocks.useTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
  });

  it('hides Admin link for logged-out users', () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, logout: vi.fn() });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Standings' })).toBeInTheDocument();
  });

  it('hides Admin link for regular users', () => {
    mocks.useAuth.mockReturnValue({
      user: { ...baseUser, role: 'user' },
      isLoading: false,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
  });

  it('shows Admin link for admin users', () => {
    mocks.useAuth.mockReturnValue({
      user: { ...baseUser, role: 'admin' },
      isLoading: false,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('hides Admin link while auth is loading', () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: true, logout: vi.fn() });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });
});
