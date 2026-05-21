import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StagedOwnerCardRow } from '../../../components/cardpool/StagedOwnerCardRow';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

describe('StagedOwnerCardRow', () => {
  it('renders thumbnail when imageUri is provided', () => {
    renderWithAppProviders(
      <StagedOwnerCardRow
        cachedCardId="card-1"
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri="https://example.com/bolt.jpg"
        quantity={1}
        applying={false}
        onQuantityChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const image = screen.getByRole('img', { name: 'Lightning Bolt' });
    expect(image).toHaveAttribute('src', 'https://example.com/bolt.jpg');
  });

  it('omits image when imageUri is null', () => {
    renderWithAppProviders(
      <StagedOwnerCardRow
        cachedCardId="card-1"
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        quantity={1}
        applying={false}
        onQuantityChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onRemove when Remove is clicked', () => {
    const onRemove = vi.fn();
    renderWithAppProviders(
      <StagedOwnerCardRow
        cachedCardId="card-1"
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        quantity={1}
        applying={false}
        onQuantityChange={vi.fn()}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
