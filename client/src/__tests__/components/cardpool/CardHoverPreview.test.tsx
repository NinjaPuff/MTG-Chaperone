import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardPreview } from '../../../components/cardpool/CardPreviewContext';
import { mockMatchMedia, restoreMatchMedia } from '../../helpers/matchMedia';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@/lib/api';

const mockedApiRequest = vi.mocked(apiRequest);

function PreviewController({
  imageUrl,
  touchActions,
  isTouchMode,
}: {
  imageUrl: string | null;
  touchActions?: { label: string; onAction: () => void }[];
  isTouchMode?: boolean;
}) {
  const { showPreview } = useCardPreview();

  return (
    <button
      type="button"
      onClick={() => {
        const rect = new DOMRect(100, 100, 80, 24);
        showPreview('card-1', 'Lightning Bolt', imageUrl, rect, { x: 140, y: 112 }, {
          touchActions: touchActions ?? [],
          isTouchMode: isTouchMode ?? false,
        });
      }}
    >
      Open preview
    </button>
  );
}

describe('CardHoverPreview', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  afterEach(() => {
    restoreMatchMedia();
  });

  it('renders desktop flyout when hover is supported and preview is not touch mode', () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    renderWithAppProviders(
      <PreviewController imageUrl="https://example.com/bolt.jpg" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    const image = screen.getByAltText('Lightning Bolt');
    expect(image).toHaveAttribute('src', 'https://example.com/bolt.jpg');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders touch modal with aria-modal, close, backdrop, and action buttons', () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    const onAction = vi.fn();
    renderWithAppProviders(
      <PreviewController
        imageUrl="https://example.com/bolt.jpg"
        isTouchMode
        touchActions={[{ label: 'Add to deck', onAction }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Lightning Bolt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to deck' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('dismisses touch modal from backdrop click and Escape key', () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    renderWithAppProviders(
      <PreviewController imageUrl="https://example.com/bolt.jpg" isTouchMode />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close card preview' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs touch action and closes modal when action button is clicked', () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    const onAction = vi.fn();
    renderWithAppProviders(
      <PreviewController
        imageUrl="https://example.com/bolt.jpg"
        isTouchMode
        touchActions={[{ label: 'Add to deck', onAction }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to deck' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fetches card image when preview imageUrl is null', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValue({
      data: {
        name: 'Lightning Bolt',
        imageUris: { normal: 'https://example.com/fetched.jpg' },
      },
    });

    renderWithAppProviders(<PreviewController imageUrl={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/card-1');
    });

    await waitFor(() => {
      expect(screen.getByAltText('Lightning Bolt')).toHaveAttribute(
        'src',
        'https://example.com/fetched.jpg',
      );
    });
  });
});
