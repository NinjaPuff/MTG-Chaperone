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

  it('shows flavor name as muted subtitle under oracle name', () => {
    renderWithAppProviders(
      <StagedOwnerCardRow
        cachedCardId="adeline-id"
        name="Adeline, Resplendent Cathar"
        flavorName="Hero of Light"
        phaseLabel="Pack 1"
        imageUri={null}
        quantity={1}
        applying={false}
        onQuantityChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Adeline, Resplendent Cathar')).toBeInTheDocument();
    expect(screen.getByText('Hero of Light')).toBeInTheDocument();
    expect(screen.getByText('Pack 1')).toBeInTheDocument();
    expect(screen.queryByText(/Adeline, Resplendent Cathar · Pack 1/)).not.toBeInTheDocument();
  });

  it('omits flavor subtitle when flavorName is null', () => {
    renderWithAppProviders(
      <StagedOwnerCardRow
        cachedCardId="card-1"
        name="Lightning Bolt"
        flavorName={null}
        phaseLabel="Pack 1"
        imageUri={null}
        quantity={1}
        applying={false}
        onQuantityChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    expect(screen.queryByText('Hero of Light')).not.toBeInTheDocument();
  });

  it('renders quantity input before the card name', () => {
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

    const quantityInput = screen.getByRole('spinbutton');
    const nameText = screen.getByText('Lightning Bolt');
    expect(quantityInput.compareDocumentPosition(nameText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('places remove button immediately after the card name', () => {
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

    const nameText = screen.getByText('Lightning Bolt');
    const removeButton = screen.getByRole('button', { name: 'Remove' });
    expect(nameText.compareDocumentPosition(removeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('calls onQuantityChange when quantity is edited', () => {
    const onQuantityChange = vi.fn();
    renderWithAppProviders(
      <StagedOwnerCardRow
        cachedCardId="card-1"
        name="Lightning Bolt"
        phaseLabel="Pack 1"
        imageUri={null}
        quantity={1}
        applying={false}
        onQuantityChange={onQuantityChange}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    expect(onQuantityChange).toHaveBeenCalledWith(3);
  });
});
