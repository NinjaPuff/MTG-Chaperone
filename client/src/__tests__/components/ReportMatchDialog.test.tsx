import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportMatchDialog } from '@/components/ReportMatchDialog';
import { mockMatchMedia, restoreMatchMedia } from '../helpers/matchMedia';

const match = {
  id: 'm1',
  player1: { id: 'p1', displayName: 'Alice' },
  player2: { id: 'p2', displayName: 'Bob' },
};

describe('ReportMatchDialog', () => {
  it('renders only two counters without draw UI', () => {
    render(
      <ReportMatchDialog
        match={match}
        bestOfN={3}
        mode="report"
        isMutating={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('Draws')).toBeNull();
    expect(screen.getByText('Alice Wins')).toBeInTheDocument();
    expect(screen.getByText('Bob Wins')).toBeInTheDocument();
  });

  it('shows draw confirmation on equal wins', () => {
    render(
      <ReportMatchDialog
        match={match}
        bestOfN={3}
        mode="report"
        isMutating={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Review Report' }));

    expect(screen.getByText(/Match ended in a draw/)).toBeInTheDocument();
    expect(screen.queryByText('Match must have a winner.')).toBeNull();
  });

  it('keeps submit button in dialog footer area', () => {
    render(
      <ReportMatchDialog
        match={match}
        bestOfN={3}
        mode="report"
        isMutating={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const submitButton = screen.getByRole('button', { name: 'Review Report' });
    expect(dialog.contains(submitButton)).toBe(true);
    expect(dialog.querySelector('.border-t')).not.toBeNull();
  });

  it('submits valid counts after confirm', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ReportMatchDialog
        match={match}
        bestOfN={3}
        mode="report"
        isMutating={false}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Review Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({ player1Wins: 2, player2Wins: 0 });
  });

  describe('autofocus', () => {
    let focusSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');
    });

    afterEach(() => {
      focusSpy.mockRestore();
      restoreMatchMedia();
    });

    const renderDialog = () =>
      render(
        <ReportMatchDialog
          match={match}
          bestOfN={3}
          mode="report"
          isMutating={false}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />,
      );

    it('does not focus the first input on touch devices', () => {
      mockMatchMedia({ '(hover: hover)': false });
      renderDialog();
      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('focuses the first input on hover-capable devices', () => {
      mockMatchMedia({ '(hover: hover)': true });
      renderDialog();
      expect(focusSpy).toHaveBeenCalled();
    });
  });
});
