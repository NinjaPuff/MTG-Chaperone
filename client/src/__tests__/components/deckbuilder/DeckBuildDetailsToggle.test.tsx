import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckBuildDetailsToggle } from '../../../components/deckbuilder/DeckBuildDetailsToggle';

describe('DeckBuildDetailsToggle', () => {
  it('marks Build as active when not in expanded mode', () => {
    render(<DeckBuildDetailsToggle expandedDeckMode={false} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange(true) when Details is clicked', () => {
    const onChange = vi.fn();
    render(<DeckBuildDetailsToggle expandedDeckMode={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange(false) when Build is clicked', () => {
    const onChange = vi.fn();
    render(<DeckBuildDetailsToggle expandedDeckMode={true} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Build' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
