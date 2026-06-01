import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StagedRowQuantityPrefix } from '../../../components/cardpool/StagedRowQuantityPrefix';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

describe('StagedRowQuantityPrefix', () => {
  it('editable mode renders a number input and fires onChange clamped to at least 1', () => {
    const onChange = vi.fn();
    renderWithAppProviders(
      <StagedRowQuantityPrefix mode="editable" value={2} onChange={onChange} />,
    );

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(2);

    fireEvent.change(input, { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith(1);

    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('editable mode disables input when disabled', () => {
    renderWithAppProviders(
      <StagedRowQuantityPrefix mode="editable" value={1} onChange={vi.fn()} disabled />,
    );

    expect(screen.getByRole('spinbutton')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });

  it('stepper buttons increment and decrement quantity', () => {
    const onChange = vi.fn();
    renderWithAppProviders(
      <StagedRowQuantityPrefix mode="editable" value={2} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('badge mode renders text without an input', () => {
    renderWithAppProviders(<StagedRowQuantityPrefix mode="badge" value="+2" />);

    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
