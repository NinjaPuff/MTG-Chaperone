import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardPreviewProvider, HoverTarget, useCardPreview } from '../../../components/cardpool/CardPreviewContext';
import { mockMatchMedia, restoreMatchMedia } from '../../helpers/matchMedia';

function PreviewProbe() {
  const { preview } = useCardPreview();
  if (!preview) {
    return <div data-testid="preview-closed">closed</div>;
  }
  return (
    <div data-testid="preview-open">
      {preview.name}
      {preview.isTouchMode ? ' touch' : ' hover'}
      {preview.touchActions.map((action) => (
        <span key={action.label} data-testid={`action-${action.label}`}>
          {action.label}
        </span>
      ))}
    </div>
  );
}

function renderHoverTarget(options?: {
  touchActions?: { label: string; onAction: () => void }[];
  onParentClick?: () => void;
}) {
  return render(
    <CardPreviewProvider>
      <div onClick={options?.onParentClick}>
        <HoverTarget
          scryfallId="card-1"
          name="Lightning Bolt"
          imageUrl="https://example.com/bolt.jpg"
          touchActions={options?.touchActions}
        >
          <button type="button">Lightning Bolt</button>
        </HoverTarget>
      </div>
      <PreviewProbe />
    </CardPreviewProvider>,
  );
}

describe('HoverTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreMatchMedia();
  });

  it('shows preview on desktop mouseenter after hover delay', () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    renderHoverTarget();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Lightning Bolt' }));
    expect(screen.getByTestId('preview-closed')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('preview-open')).toHaveTextContent('Lightning Bolt hover');
  });

  it('hides preview on desktop mouseleave', () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    renderHoverTarget();
    const target = screen.getByRole('button', { name: 'Lightning Bolt' });

    fireEvent.mouseEnter(target);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('preview-open')).toBeInTheDocument();

    fireEvent.mouseLeave(target);
    expect(screen.getByTestId('preview-closed')).toBeInTheDocument();
  });

  it('opens touch preview on tap and stops parent click propagation', () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    const onParentClick = vi.fn();
    renderHoverTarget({ onParentClick });

    fireEvent.click(screen.getByRole('button', { name: 'Lightning Bolt' }));

    expect(onParentClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('preview-open')).toHaveTextContent('Lightning Bolt touch');
  });

  it('dismisses touch preview when tapping the same card again', () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    renderHoverTarget();
    const target = screen.getByRole('button', { name: 'Lightning Bolt' });

    fireEvent.click(target);
    expect(screen.getByTestId('preview-open')).toBeInTheDocument();

    fireEvent.click(target);
    expect(screen.getByTestId('preview-closed')).toBeInTheDocument();
  });

  it('passes touchActions into touch preview state', () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    const onAction = vi.fn();
    renderHoverTarget({
      touchActions: [{ label: 'Add to deck', onAction }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Lightning Bolt' }));

    expect(screen.getByTestId('action-Add to deck')).toBeInTheDocument();
  });
});
