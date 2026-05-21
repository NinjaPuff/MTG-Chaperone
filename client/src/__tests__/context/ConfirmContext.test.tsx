import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, useConfirm } from '@/context/ConfirmContext';

function Probe() {
  const { confirm } = useConfirm();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void confirm({
            title: 'Delete deck',
            message: 'This cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Keep',
            variant: 'destructive',
          }).then((confirmed) => {
            const result = document.querySelector('[data-testid="result"]');
            if (result) {
              result.textContent = confirmed ? 'yes' : 'no';
            }
          });
        }}
      >
        ask delete
      </button>
      <button
        type="button"
        onClick={() => {
          void confirm({
            title: 'Second prompt',
            message: 'Queued dialog',
          }).then((confirmed) => {
            const result = document.querySelector('[data-testid="queue-result"]');
            if (result) {
              result.textContent = confirmed ? 'second-yes' : 'second-no';
            }
          });
        }}
      >
        ask second
      </button>
      <div data-testid="result">pending</div>
      <div data-testid="queue-result">pending</div>
    </div>
  );
}

describe('ConfirmContext', () => {
  it('throws when useConfirm is used outside ConfirmProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useConfirm must be used inside ConfirmProvider');
    consoleError.mockRestore();
  });

  it('resolves true when confirmed and false when cancelled', async () => {
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ask delete' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete deck')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('no'));

    fireEvent.click(screen.getByRole('button', { name: 'ask delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('yes'));
  });

  it('shows one dialog at a time and processes the queue in order', async () => {
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ask delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'ask second' }));

    expect(screen.getByText('Delete deck')).toBeInTheDocument();
    expect(screen.queryByText('Second prompt')).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('yes'));

    expect(screen.getByText('Second prompt')).toBeInTheDocument();
    expect(screen.queryByText('Delete deck')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByTestId('queue-result').textContent).toBe('second-no'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
