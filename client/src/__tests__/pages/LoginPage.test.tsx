import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { RETURN_URL_STORAGE_KEY } from '@/lib/returnUrl';
import { LoginPage } from '@/pages/LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores returnUrl on mount when query param is valid', async () => {
    render(
      <MemoryRouter initialEntries={['/login?returnUrl=%2Fjoin%3Ftoken%3Dabc']}>
        <LoginPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe('/join?token=abc');
    });
  });

  it('ignores malicious returnUrl values', async () => {
    render(
      <MemoryRouter initialEntries={['/login?returnUrl=https%3A%2F%2Fevil.com']}>
        <LoginPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
    });
  });

  it('does not write sessionStorage when returnUrl param is absent', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
    });
  });
});
