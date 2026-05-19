import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StagedChangeRow } from '../../../components/cardpool/StagedChangeRow';

describe('StagedChangeRow', () => {
  it('renders thumbnail when imageUri is provided', () => {
    render(
      <StagedChangeRow
        label="Add +1 - Lightning Bolt (Pack 1)"
        imageUri="https://example.com/bolt.jpg"
        imageAlt="Lightning Bolt"
        applying={false}
        onRemove={vi.fn()}
      />,
    );

    const image = screen.getByRole('img', { name: 'Lightning Bolt' });
    expect(image).toHaveAttribute('src', 'https://example.com/bolt.jpg');
  });

  it('omits image when imageUri is null', () => {
    render(
      <StagedChangeRow
        label="Remove -1 - Lightning Bolt (Pack 1)"
        imageUri={null}
        imageAlt="Lightning Bolt"
        applying={false}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Remove -1 - Lightning Bolt (Pack 1)')).toBeInTheDocument();
  });

  it('calls onRemove when Remove is clicked', () => {
    const onRemove = vi.fn();
    render(
      <StagedChangeRow
        label="Add +1 - Lightning Bolt (Pack 1)"
        imageUri={null}
        imageAlt="Lightning Bolt"
        applying={false}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables Remove when applying', () => {
    render(
      <StagedChangeRow
        label="Add +1 - Lightning Bolt (Pack 1)"
        imageUri={null}
        imageAlt="Lightning Bolt"
        applying={true}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });
});
