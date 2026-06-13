import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCardImageCachesForTests } from '../../../lib/cardImage';
import { PoolCardImage } from '../../../components/cardpool/PoolCardImage';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@/lib/api';

const mockedApiRequest = vi.mocked(apiRequest);

describe('PoolCardImage', () => {
  beforeEach(() => {
    clearCardImageCachesForTests();
    mockedApiRequest.mockReset();
  });

  it('renders first candidate image', () => {
    render(
      <PoolCardImage
        name="Lightning Bolt"
        imageUris={{ normal: 'https://a/n.jpg', border_crop: 'https://a/bc.jpg' }}
      />,
    );

    expect(screen.getByTestId('pool-card-image')).toHaveAttribute('src', 'https://a/n.jpg');
  });

  it('rotates to next candidate on error', () => {
    render(
      <PoolCardImage
        name="Lightning Bolt"
        imageUris={{ normal: 'https://a/n.jpg', border_crop: 'https://a/bc.jpg' }}
      />,
    );

    fireEvent.error(screen.getByTestId('pool-card-image'));

    expect(screen.getByTestId('pool-card-image')).toHaveAttribute('src', 'https://a/bc.jpg');
  });

  it('shows text fallback when all local candidates fail and no scryfallId exists', () => {
    render(
      <PoolCardImage
        name="Lightning Bolt"
        imageUris={{ normal: 'https://a/n.jpg', border_crop: 'https://a/bc.jpg' }}
      />,
    );

    fireEvent.error(screen.getByTestId('pool-card-image'));
    fireEvent.error(screen.getByTestId('pool-card-image'));

    expect(screen.queryByTestId('pool-card-image')).not.toBeInTheDocument();
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
  });

  it('shows text fallback immediately for null imageUris', () => {
    render(<PoolCardImage name="Lightning Bolt" imageUris={null} />);

    expect(screen.queryByTestId('pool-card-image')).not.toBeInTheDocument();
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
  });

  it('fetches card image once after local candidates exhaust', async () => {
    mockedApiRequest.mockResolvedValue({
      data: {
        imageUris: { normal: 'https://a/fetched.jpg' },
      },
    });

    render(<PoolCardImage name="Lightning Bolt" scryfallId="bolt-1" imageUris={{ normal: 'https://a/n.jpg' }} />);

    fireEvent.error(screen.getByTestId('pool-card-image'));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/bolt-1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('pool-card-image')).toHaveAttribute('src', 'https://a/fetched.jpg');
    });
  });

  it('does not call API when scryfallId is missing', async () => {
    render(<PoolCardImage name="Lightning Bolt" imageUris={{ normal: 'https://a/n.jpg' }} />);
    fireEvent.error(screen.getByTestId('pool-card-image'));

    await waitFor(() => {
      expect(mockedApiRequest).not.toHaveBeenCalled();
    });
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
  });

  it('dedupes API fetch across two tiles for same scryfallId', async () => {
    mockedApiRequest.mockResolvedValue({
      data: {
        imageUris: { normal: 'https://a/fetched.jpg' },
      },
    });

    render(
      <div>
        <PoolCardImage
          name="Bolt A"
          scryfallId="bolt-1"
          imageUris={{ normal: 'https://a/invalid-a.jpg' }}
          data-testid="pool-card-image-a"
        />
        <PoolCardImage
          name="Bolt B"
          scryfallId="bolt-1"
          imageUris={{ normal: 'https://a/invalid-b.jpg' }}
          data-testid="pool-card-image-b"
        />
      </div>,
    );

    fireEvent.error(screen.getByTestId('pool-card-image-a'));
    fireEvent.error(screen.getByTestId('pool-card-image-b'));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('falls back to text when API refresh fails', async () => {
    mockedApiRequest.mockRejectedValue(new Error('boom'));
    render(<PoolCardImage name="Lightning Bolt" scryfallId="bolt-1" imageUris={{ normal: 'https://a/n.jpg' }} />);

    fireEvent.error(screen.getByTestId('pool-card-image'));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/bolt-1');
    });
    await waitFor(() => {
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });
  });
});
