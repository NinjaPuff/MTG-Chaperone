import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasicLandAdderPopup } from '@/components/deckbuilder/BasicLandAdderPopup';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

describe('BasicLandAdderPopup', () => {
  const defaultProps = {
    mainCounts: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    },
    sideboardCounts: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    },
    minDeckSize: 40,
    mainDeckCards: [],
    onMainChange: vi.fn(),
    onSideboardChange: vi.fn(),
  };

  it('shows compact trigger button with total count', () => {
    renderWithAppProviders(
      <BasicLandAdderPopup
        {...defaultProps}
        mainCounts={{ ...defaultProps.mainCounts, Forest: 8, Island: 4 }}
        sideboardCounts={{ ...defaultProps.sideboardCounts, Mountain: 2 }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Basic Lands (14)' })).toBeInTheDocument();
  });

  it('opens dialog with land controls on click', () => {
    renderWithAppProviders(<BasicLandAdderPopup {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest Lands' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Main Deck' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Wastes')).not.toBeInTheDocument();
  });

  it('hides suggest lands on the sideboard tab', () => {
    renderWithAppProviders(<BasicLandAdderPopup {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sideboard' }));

    expect(screen.queryByRole('button', { name: 'Suggest Lands' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sideboard' })).toHaveAttribute('aria-selected', 'true');
  });

  it('routes sideboard changes through onSideboardChange', () => {
    const onSideboardChange = vi.fn();
    renderWithAppProviders(
      <BasicLandAdderPopup {...defaultProps} onSideboardChange={onSideboardChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sideboard' }));
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);

    expect(onSideboardChange).toHaveBeenCalledWith({
      Plains: 1,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    });
  });

  it('closes dialog when backdrop is clicked', () => {
    renderWithAppProviders(<BasicLandAdderPopup {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close basic lands dialog' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prompts before replacing when forests are already present', async () => {
    const onMainChange = vi.fn();
    renderWithAppProviders(
      <BasicLandAdderPopup
        {...defaultProps}
        onMainChange={onMainChange}
        mainCounts={{ ...defaultProps.mainCounts, Forest: 8 }}
        mainDeckCards={[{ quantity: 23, manaCost: '{G}', typeLine: 'Creature - Elf', colorIdentity: ['G'] }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Basic Lands (8)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest Lands' }));

    expect(await screen.findByText('Replace current basic lands with suggested values?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => {
      expect(onMainChange).toHaveBeenCalledWith({
        Plains: 0,
        Island: 0,
        Swamp: 0,
        Mountain: 0,
        Forest: 17,
      });
    });
    expect(onMainChange.mock.calls[0][0]).not.toHaveProperty('Wastes');
  });
});
