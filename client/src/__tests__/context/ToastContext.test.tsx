import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@/context/ToastContext';

function Probe() {
  const { showToast } = useToast();
  return (
    <div>
      <button type="button" onClick={() => showToast({ message: 'Saved changes' })}>
        show default
      </button>
      <button type="button" onClick={() => showToast({ message: 'Staged card', variant: 'success' })}>
        show success
      </button>
    </div>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when useToast is used outside ToastProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useToast must be used inside ToastProvider');
    consoleError.mockRestore();
  });

  it('shows a toast with role=status and auto-dismisses after 3 seconds', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'show default' }));

    const toast = screen.getByRole('status', { name: 'Saved changes' });
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass('border-border');

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByRole('status', { name: 'Saved changes' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status', { name: 'Saved changes' })).not.toBeInTheDocument();
  });

  it('applies success styling for success variant toasts', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'show success' }));

    const toast = screen.getByRole('status', { name: 'Staged card' });
    expect(toast).toHaveClass('border-emerald-500/50');
  });
});
