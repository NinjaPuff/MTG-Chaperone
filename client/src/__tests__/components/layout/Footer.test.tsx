import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Footer', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('always shows attribution links', async () => {
    vi.stubEnv('VITE_KOFI_URL', '');
    const { Footer } = await import('@/components/layout/Footer');

    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Scryfall' })).toHaveAttribute('href', 'https://scryfall.com');
    expect(screen.getByRole('link', { name: 'mtg-vectors' })).toHaveAttribute(
      'href',
      'https://github.com/Investigamer/mtg-vectors',
    );
  });

  it('hides Ko-fi support link when VITE_KOFI_URL is unset', async () => {
    vi.stubEnv('VITE_KOFI_URL', '');
    const { Footer } = await import('@/components/layout/Footer');

    render(<Footer />);

    expect(screen.queryByRole('link', { name: /ko-fi/i })).toBeNull();
  });

  it('shows Ko-fi support link when VITE_KOFI_URL is set', async () => {
    vi.stubEnv('VITE_KOFI_URL', 'https://ko-fi.com/example');
    const { Footer } = await import('@/components/layout/Footer');

    render(<Footer />);

    const link = screen.getByRole('link', { name: /ko-fi/i });
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/example');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
