import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareDeckDialog } from '@/components/deckbuilder/ShareDeckDialog';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

const SHORT_URL = 'https://league.example/share/decks/tok_short';
const LONG_URL = `https://league.example/share/decks#v1.${'x'.repeat(2000)}`;

describe('ShareDeckDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a short disclaimer, the URL next to Copy, and no character count', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    renderWithAppProviders(<ShareDeckDialog url={SHORT_URL} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Share decklist' })).toBeInTheDocument();
    expect(screen.getByText(SHORT_URL)).toBeInTheDocument();
    expect(screen.getByText(/anyone with the link can see this list/i)).toBeInTheDocument();
    expect(screen.getByText(/won’t show up on \/decks/i)).toBeInTheDocument();
    expect(screen.queryByText(/characters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forwarding cannot be undone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/too long to paste into Discord/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' }).parentElement).toContainElement(
      screen.getByText(SHORT_URL),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(SHORT_URL);
    expect(await screen.findByRole('status', { name: 'Share link copied' })).toBeInTheDocument();
  });

  it('warns when the URL exceeds Discord length but still copies the full string', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    renderWithAppProviders(<ShareDeckDialog url={LONG_URL} onClose={vi.fn()} />);

    expect(screen.getByText(/too long to paste into Discord/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(LONG_URL);
  });

  it('closes from the close button and backdrop without fetching', () => {
    const onClose = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderWithAppProviders(<ShareDeckDialog url={SHORT_URL} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close share dialog' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
