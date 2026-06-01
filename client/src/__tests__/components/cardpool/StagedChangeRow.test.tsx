import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StagedChangeRow } from '../../../components/cardpool/StagedChangeRow';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

describe('StagedChangeRow', () => {
  it('renders thumbnail when imageUri is provided', () => {
    renderWithAppProviders(
      <StagedChangeRow
        cachedCardId="card-1"
        action="add"
        quantity={1}
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri="https://example.com/bolt.jpg"
        applying={false}
        onRemove={vi.fn()}
      />,
    );

    const image = screen.getByRole('img', { name: 'Lightning Bolt' });
    expect(image).toHaveAttribute('src', 'https://example.com/bolt.jpg');
  });

  it('omits image when imageUri is null', () => {
    renderWithAppProviders(
      <StagedChangeRow
        cachedCardId="card-1"
        action="remove_one"
        quantity={1}
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        applying={false}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Remove · Lightning Bolt · Pack 1')).toBeInTheDocument();
  });

  it('calls onRemove when Remove is clicked', () => {
    const onRemove = vi.fn();
    renderWithAppProviders(
      <StagedChangeRow
        cachedCardId="card-1"
        action="add"
        quantity={1}
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        applying={false}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables Remove when applying', () => {
    renderWithAppProviders(
      <StagedChangeRow
        cachedCardId="card-1"
        action="add"
        quantity={1}
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        applying={true}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('renders add badge and label for admin add action', () => {
    renderWithAppProviders(
      <StagedChangeRow
        cachedCardId="card-1"
        action="add"
        quantity={2}
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        applying={false}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('Add · Lightning Bolt · Pack 1')).toBeInTheDocument();
  });

  it('renders remove badge for remove_one action', () => {
    renderWithAppProviders(
      <StagedChangeRow
        cachedCardId="card-1"
        action="remove_one"
        quantity={1}
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        applying={false}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('−1')).toBeInTheDocument();
    expect(screen.getByText('Remove · Lightning Bolt · Pack 1')).toBeInTheDocument();
  });

  it('renders All badge for remove_all action', () => {
    renderWithAppProviders(
      <StagedChangeRow
        cachedCardId="card-1"
        action="remove_all"
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        applying={false}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Remove all · Lightning Bolt · Pack 1')).toBeInTheDocument();
  });
});
