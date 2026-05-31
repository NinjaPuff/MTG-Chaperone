import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

import { Sidebar } from '@/components/layout/Sidebar';

const baseUser = {
  id: 'user-1',
  displayName: 'User',
  publicName: null,
  slug: 'user',
  avatarUrl: null,
};

describe('Sidebar', () => {
  beforeEach(() => {
    mocks.useAuth.mockReset();
  });

  it('hides Admin link for logged-out users', () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false });

    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('hides Admin link for regular users', () => {
    mocks.useAuth.mockReturnValue({
      user: { ...baseUser, role: 'user' },
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });

  it('shows Admin link for admin users', () => {
    mocks.useAuth.mockReturnValue({
      user: { ...baseUser, role: 'admin' },
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('hides Admin link while auth is loading', () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: true });

    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });
});
