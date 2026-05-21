import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title, message, and action labels', () => {
    render(
      <ConfirmDialog
        title="Remove card"
        message="Remove Lightning Bolt from the pool?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Remove card')).toBeInTheDocument();
    expect(screen.getByText('Remove Lightning Bolt from the pool?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm and onCancel from action buttons', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Discard changes"
        message="Unsaved edits will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the backdrop is clicked', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Discard changes"
        message="Unsaved edits will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close confirmation dialog' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('styles destructive confirmations on the confirm action', () => {
    render(
      <ConfirmDialog
        title="Delete pool"
        message="This action is permanent."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('text-destructive');
  });
});
