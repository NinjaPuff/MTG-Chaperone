import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasicLandAdderPopup } from '@/components/deckbuilder/BasicLandAdderPopup';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

describe('BasicLandAdderPopup', () => {
  const defaultProps = {
    counts: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
      Wastes: 0,
    },
    minDeckSize: 40,
    deckCards: [],
    onChange: vi.fn(),
  };

  it('shows compact trigger button with total count', () => {
    renderWithAppProviders(
      <BasicLandAdderPopup
        {...defaultProps}
        counts={{ ...defaultProps.counts, Forest: 8, Island: 4 }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Basic Lands (12)' })).toBeInTheDocument();
  });

  it('opens dialog with land controls on click', () => {
    renderWithAppProviders(<BasicLandAdderPopup {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest Lands' })).toBeInTheDocument();
  });

  it('closes dialog when backdrop is clicked', () => {
    renderWithAppProviders(<BasicLandAdderPopup {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close basic lands dialog' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
