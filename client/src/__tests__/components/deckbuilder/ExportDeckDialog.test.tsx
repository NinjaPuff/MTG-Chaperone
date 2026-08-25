import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportDeckDialog } from '@/components/deckbuilder/ExportDeckDialog';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';
import type { DeckBuilderCard } from '@/components/deckbuilder/types';

const cards: DeckBuilderCard[] = [
  {
    cachedCardId: 'island-1',
    name: 'Island',
    layout: 'normal',
    manaCost: null,
    typeLine: 'Basic Land — Island',
    cmc: 0,
    quantity: 4,
    zone: 'main',
    colorIdentity: ['U'],
    setCode: 'USG',
    collectorNumber: '335',
  },
  {
    cachedCardId: 'hydro-1',
    name: 'Hydroblast',
    layout: 'normal',
    manaCost: '{U}',
    typeLine: 'Instant',
    cmc: 1,
    quantity: 2,
    zone: 'sideboard',
    colorIdentity: ['U'],
    setCode: 'ICE',
    collectorNumber: '72',
  },
];

describe('ExportDeckDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('copies Moxfield text and switches to Archidekt Nx lines', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    renderWithAppProviders(
      <ExportDeckDialog deckName="Alice Aggro" cards={cards} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog', { name: 'Export deck' })).toBeInTheDocument();
    expect(screen.getByTestId('deck-export-text')).toHaveTextContent('4 Island (USG) 335');
    expect(screen.getByTestId('deck-export-text')).toHaveTextContent('Sideboard');
    expect(screen.queryByText(/characters/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(
      ['Deck', '4 Island (USG) 335', '', 'Sideboard', '2 Hydroblast (ICE) 72'].join('\n'),
    );
    expect(await screen.findByRole('status', { name: 'Decklist copied' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Archidekt' }));
    expect(screen.getByTestId('deck-export-text')).toHaveTextContent('4x Island (USG) 335');
  });

  it('closes from Close, backdrop, and Escape', () => {
    const onClose = vi.fn();
    renderWithAppProviders(
      <ExportDeckDialog deckName="Alice Aggro" cards={cards} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close export dialog' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
