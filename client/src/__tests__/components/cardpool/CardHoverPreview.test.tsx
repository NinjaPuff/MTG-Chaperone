import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardPreview } from '../../../components/cardpool/CardPreviewContext';
import { clearCardImageCachesForTests } from '../../../lib/cardImage';
import { clearCardHoverPreviewCachesForTests } from '../../../components/cardpool/CardHoverPreview';
import { mockMatchMedia, restoreMatchMedia } from '../../helpers/matchMedia';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@/lib/api';

const mockedApiRequest = vi.mocked(apiRequest);

const SIEGE_ID = 'siege-ikoria-1';
const siegeFacesResponse = {
  data: {
    faces: [
      {
        name: 'Invasion of Ikoria',
        typeLine: 'Battle — Siege',
        imageUris: { normal: 'https://example.com/siege-front.jpg' },
      },
      {
        name: 'Zilortha, Apex of Ikoria',
        typeLine: 'Legendary Creature — Dinosaur',
        imageUris: { normal: 'https://example.com/siege-back.jpg' },
      },
    ],
  },
};

function PreviewController({
  scryfallId = 'card-1',
  name = 'Lightning Bolt',
  layout = null,
  typeLine = null,
  imageUrl,
  touchActions,
  isTouchMode,
}: {
  scryfallId?: string;
  name?: string;
  layout?: string | null;
  typeLine?: string | null;
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
        showPreview(scryfallId, name, layout, typeLine, imageUrl, rect, { x: 140, y: 112 }, {
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
    clearCardImageCachesForTests();
    clearCardHoverPreviewCachesForTests();
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

  it('uses rotated landscape sizing for split card desktop hover preview', () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    renderWithAppProviders(
      <PreviewController
        name="Fire // Ice"
        layout="split"
        imageUrl="https://example.com/fire-ice.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    const image = screen.getByAltText('Fire');
    expect(image).toHaveClass('rotate-90', 'object-contain');
  });

  it('uses rotated landscape sizing for room card desktop hover preview', () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    renderWithAppProviders(
      <PreviewController
        name="Dollmaker's Shop // Porcelain Gallery"
        layout="split"
        typeLine="Enchantment — Room"
        imageUrl="https://example.com/dollmaker.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    const image = screen.getByAltText("Dollmaker's Shop");
    expect(image).toHaveClass('rotate-90', 'object-contain');
  });

  it('uses landscape sizing for battle face on Siege desktop hover', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValueOnce(siegeFacesResponse);

    renderWithAppProviders(
      <PreviewController
        scryfallId={SIEGE_ID}
        name="Invasion of Ikoria // Zilortha, Apex of Ikoria"
        layout="transform"
        typeLine="Battle — Siege // Legendary Creature — Dinosaur"
        imageUrl="https://example.com/siege-front.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(`/api/cards/${SIEGE_ID}/faces`);
    });

    await waitFor(() => {
      expect(screen.getByAltText('Invasion of Ikoria')).toHaveClass('rotate-90', 'object-contain');
    });

    expect(screen.getByAltText('Zilortha, Apex of Ikoria')).toHaveClass('max-w-[360px]');
  });

  it('uses landscape battle face and portrait back on Siege touch modal', async () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    mockedApiRequest.mockResolvedValueOnce(siegeFacesResponse);

    renderWithAppProviders(
      <PreviewController
        scryfallId={SIEGE_ID}
        name="Invasion of Ikoria // Zilortha, Apex of Ikoria"
        layout="transform"
        typeLine="Battle — Siege // Legendary Creature — Dinosaur"
        imageUrl="https://example.com/siege-front.jpg"
        isTouchMode
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveClass('max-w-2xl');
    });

    expect(screen.getByAltText('Invasion of Ikoria')).toHaveClass('rotate-90', 'object-contain');
    expect(screen.getByAltText('Zilortha, Apex of Ikoria')).toHaveClass('max-w-[360px]');
  });

  it('infers battle face landscape sizing when faces API omits typeLine', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValueOnce({
      data: {
        faces: [
          {
            name: 'Invasion of Ikoria',
            imageUris: { normal: 'https://example.com/siege-front.jpg' },
          },
          {
            name: 'Zilortha, Apex of Ikoria',
            imageUris: { normal: 'https://example.com/siege-back.jpg' },
          },
        ],
      },
    });

    renderWithAppProviders(
      <PreviewController
        scryfallId={SIEGE_ID}
        name="Invasion of Ikoria // Zilortha, Apex of Ikoria"
        layout="transform"
        typeLine="Battle — Siege // Legendary Creature — Dinosaur"
        imageUrl="https://example.com/siege-front.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(screen.getByAltText('Invasion of Ikoria')).toHaveClass('rotate-90');
    });
    expect(screen.getByAltText('Zilortha, Apex of Ikoria')).toHaveClass('max-w-[360px]');
  });

  it('uses portrait sizing for both faces on non-battle transform hover', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValueOnce({
      data: {
        faces: [
          {
            name: 'Delver of Secrets',
            typeLine: 'Legendary Creature — Human',
            imageUris: { normal: 'https://example.com/front.jpg' },
          },
          {
            name: 'Insectile Aberration',
            typeLine: 'Legendary Creature — Human',
            imageUris: { normal: 'https://example.com/back.jpg' },
          },
        ],
      },
    });

    renderWithAppProviders(
      <PreviewController
        scryfallId="transform-portrait-1"
        name="Delver of Secrets // Insectile Aberration"
        layout="transform"
        imageUrl="https://example.com/front.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(screen.getByAltText('Delver of Secrets')).toBeInTheDocument();
    });

    expect(screen.getByAltText('Delver of Secrets')).toHaveClass('max-w-[360px]');
    expect(screen.getByAltText('Delver of Secrets')).not.toHaveClass('max-w-[min(92vw,640px)]');
    expect(screen.getByAltText('Insectile Aberration')).toHaveClass('max-w-[360px]');
    expect(screen.getByAltText('Insectile Aberration')).not.toHaveClass('max-w-[min(92vw,640px)]');
  });

  it('resolves landscape layout from API when hover target passes null layout', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValue({
      data: {
        layout: 'split',
        imageUris: { normal: 'https://example.com/fire-ice.jpg' },
      },
    });

    renderWithAppProviders(
      <PreviewController
        name="Fire // Ice"
        layout={null}
        imageUrl="https://example.com/fire-ice.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/card-1');
    });

    await waitFor(() => {
      expect(screen.getByAltText('Fire')).toHaveClass('rotate-90', 'object-contain');
    });
  });

  it('uses wider touch dialog and rotated landscape sizing for split cards', () => {
    mockMatchMedia({ '(hover: hover)': false, '(hover: none)': true });
    renderWithAppProviders(
      <PreviewController
        name="Fire // Ice"
        layout="split"
        imageUrl="https://example.com/fire-ice.jpg"
        isTouchMode
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    expect(screen.getByRole('dialog')).toHaveClass('max-w-2xl');
    expect(screen.getByAltText('Fire')).toHaveClass('rotate-90', 'object-contain');
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

  it('does not fetch faces when layout is adventure', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValue({
      data: {
        name: 'Bonecrusher Giant // Stomp',
        imageUris: { normal: 'https://example.com/adventure.jpg' },
      },
    });

    renderWithAppProviders(
      <PreviewController
        scryfallId="adventure-1"
        name="Bonecrusher Giant // Stomp"
        layout="adventure"
        imageUrl={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/adventure-1');
    });
    expect(mockedApiRequest).not.toHaveBeenCalledWith('/api/cards/adventure-1/faces');
  });

  it('does not fetch faces when layout is prepare', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValue({
      data: {
        name: 'Joined Researchers // Secret Rendition',
        imageUris: { normal: 'https://example.com/prepare.jpg' },
      },
    });

    renderWithAppProviders(
      <PreviewController
        scryfallId="prepare-1"
        name="Joined Researchers // Secret Rendition"
        layout="prepare"
        imageUrl={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/prepare-1');
    });
    expect(mockedApiRequest).not.toHaveBeenCalledWith('/api/cards/prepare-1/faces');
  });

  it('fetches faces when layout is transform', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValueOnce({
      data: {
        faces: [
          { name: 'Delver of Secrets', imageUris: { normal: 'https://example.com/front.jpg' } },
          { name: 'Insectile Aberration', imageUris: { normal: 'https://example.com/back.jpg' } },
        ],
      },
    });

    renderWithAppProviders(
      <PreviewController
        scryfallId="transform-1"
        name="Delver of Secrets // Insectile Aberration"
        layout="transform"
        imageUrl="https://example.com/front.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/transform-1/faces');
    });
  });

  it('rotates face image candidates after image error', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValueOnce({
      data: {
        faces: [
          {
            name: 'Delver of Secrets',
            imageUris: {
              normal: 'https://example.com/front-normal.jpg',
              small: 'https://example.com/front-small.jpg',
            },
          },
        ],
      },
    });

    renderWithAppProviders(
      <PreviewController
        scryfallId="transform-rotate-1"
        name="Delver of Secrets // Insectile Aberration"
        layout="transform"
        imageUrl="https://example.com/front-normal.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/transform-rotate-1/faces');
    });

    const faceImage = screen.getByAltText('Delver of Secrets');
    expect(faceImage).toHaveAttribute('src', 'https://example.com/front-normal.jpg');

    fireEvent.error(faceImage);

    await waitFor(() => {
      expect(screen.getByAltText('Delver of Secrets')).toHaveAttribute('src', 'https://example.com/front-small.jpg');
    });
  });

  it('fetches faces when layout is modal_dfc', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValueOnce({
      data: {
        faces: [
          { name: 'Valakut Awakening', imageUris: { normal: 'https://example.com/front.jpg' } },
          { name: 'Valakut Stoneforge', imageUris: { normal: 'https://example.com/back.jpg' } },
        ],
      },
    });

    renderWithAppProviders(
      <PreviewController
        scryfallId="mdfc-1"
        name="Valakut Awakening // Valakut Stoneforge"
        layout="modal_dfc"
        imageUrl="https://example.com/front.jpg"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/mdfc-1/faces');
    });
  });

  it('does not fetch faces when layout is null and name has separator', async () => {
    mockMatchMedia({ '(hover: hover)': true, '(hover: none)': false });
    mockedApiRequest.mockResolvedValue({
      data: {
        name: 'X // Y',
        imageUris: { normal: 'https://example.com/single.jpg' },
      },
    });

    renderWithAppProviders(
      <PreviewController scryfallId="unknown-1" name="X // Y" layout={null} imageUrl={null} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/cards/unknown-1');
    });
    expect(mockedApiRequest).not.toHaveBeenCalledWith('/api/cards/unknown-1/faces');
  });
});
