import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { frontFaceName, isDoubleSidedLayout } from '@/lib/cardLayout';
import { deviceHasHover, useCardPreview } from './CardPreviewContext';

type CardFace = {
  name: string;
  imageUris: Record<string, string> | null;
};

type CardFacesResponse = {
  data: {
    faces: CardFace[];
  };
};

type CardResponse = {
  data: {
    name: string;
    imageUris: Record<string, string> | null;
  };
};

const facesCache = new Map<string, CardFace[]>();
const imageCache = new Map<string, string>();

function getFaceImage(face: CardFace): string | null {
  if (!face.imageUris) {
    return null;
  }
  const url = face.imageUris.normal ?? face.imageUris.small ?? null;
  return typeof url === 'string' ? url : null;
}

function getCardImage(imageUris: Record<string, string> | null | undefined): string | null {
  if (!imageUris) {
    return null;
  }
  const url = imageUris.normal ?? imageUris.small ?? null;
  return typeof url === 'string' ? url : null;
}

function DesktopFlyout({
  displayFaces,
  loadingFaces,
  left,
  top,
}: {
  displayFaces: CardFace[];
  loadingFaces: boolean;
  left: number;
  top: number;
}) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-sm"
      style={{ left, top }}
      aria-hidden
    >
      <div className={`flex gap-2 ${loadingFaces ? 'animate-pulse' : ''}`}>
        {displayFaces.map((face, index) => {
          const image = getFaceImage(face);
          return image ? (
            <img
              key={`${face.name}-${index}`}
              src={image}
              alt={face.name}
              className="max-h-[80vh] w-auto max-w-[240px] rounded-md border border-border object-contain"
            />
          ) : (
            <div
              key={`${face.name}-${index}`}
              className="flex h-[336px] w-[240px] items-center justify-center rounded-md border border-border bg-muted p-3 text-center text-xs text-muted-foreground"
            >
              {face.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TouchPreviewModal({
  cardName,
  displayFaces,
  loadingFaces,
  touchActions,
  onClose,
}: {
  cardName: string;
  displayFaces: CardFace[];
  loadingFaces: boolean;
  touchActions: { label: string; onAction: () => void }[];
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close card preview"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-preview-title"
        className="relative flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-xl border border-border bg-card p-4 shadow-lg sm:max-w-lg sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="card-preview-title" className="text-sm font-semibold leading-tight">
            {cardName}
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className={`flex flex-wrap justify-center gap-2 ${loadingFaces ? 'animate-pulse' : ''}`}>
          {displayFaces.map((face, index) => {
            const image = getFaceImage(face);
            return image ? (
              <img
                key={`${face.name}-${index}`}
                src={image}
                alt={face.name}
                className="max-h-[55vh] w-auto max-w-[240px] rounded-md border border-border object-contain"
              />
            ) : (
              <div
                key={`${face.name}-${index}`}
                className="flex h-[336px] w-[240px] items-center justify-center rounded-md border border-border bg-muted p-3 text-center text-xs text-muted-foreground"
              >
                {face.name}
              </div>
            );
          })}
        </div>
        {touchActions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {touchActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  action.onAction();
                  onClose();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CardHoverPreview() {
  const { preview, hidePreview } = useCardPreview();
  const [isHoverCapable, setIsHoverCapable] = useState(deviceHasHover);
  const [faces, setFaces] = useState<CardFace[] | null>(null);
  const [loadingFaces, setLoadingFaces] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    setIsHoverCapable(deviceHasHover());
  }, []);

  useEffect(() => {
    if (!preview || !isDoubleSidedLayout(preview.layout)) {
      setFaces(null);
      setLoadingFaces(false);
      return;
    }

    const cachedFaces = facesCache.get(preview.scryfallId);
    if (cachedFaces) {
      setFaces(cachedFaces);
      setLoadingFaces(false);
      return;
    }

    let cancelled = false;
    setLoadingFaces(true);
    setFaces(null);

    void apiRequest<CardFacesResponse>(`/api/cards/${preview.scryfallId}/faces`)
      .then((response) => {
        if (cancelled) {
          return;
        }
        facesCache.set(preview.scryfallId, response.data.faces);
        setFaces(response.data.faces);
      })
      .catch(() => {
        if (!cancelled) {
          setFaces(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFaces(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preview]);

  useEffect(() => {
    if (!preview) {
      setResolvedImageUrl(null);
      setLoadingImage(false);
      return;
    }

    if (preview.imageUrl) {
      setResolvedImageUrl(preview.imageUrl);
      setLoadingImage(false);
      return;
    }

    const cachedImage = imageCache.get(preview.scryfallId);
    if (cachedImage) {
      setResolvedImageUrl(cachedImage);
      setLoadingImage(false);
      return;
    }

    let cancelled = false;
    setLoadingImage(true);
    setResolvedImageUrl(null);

    void apiRequest<CardResponse>(`/api/cards/${preview.scryfallId}`)
      .then((response) => {
        if (cancelled) {
          return;
        }
        const imageUrl = getCardImage(response.data.imageUris);
        if (imageUrl) {
          imageCache.set(preview.scryfallId, imageUrl);
        }
        setResolvedImageUrl(imageUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedImageUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingImage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preview]);

  const displayFaces = useMemo(() => {
    if (!preview) {
      return [];
    }
    const displayName = frontFaceName(preview.name, preview.layout);
    if (faces && faces.length > 0) {
      return faces;
    }
    return [
      {
        name: displayName,
        imageUris: resolvedImageUrl ? { normal: resolvedImageUrl } : null,
      },
    ];
  }, [faces, preview, resolvedImageUrl]);

  if (!preview || typeof document === 'undefined') {
    return null;
  }

  const isLoading = loadingFaces || loadingImage;
  const useDesktopFlyout = isHoverCapable && !preview.isTouchMode;

  if (useDesktopFlyout) {
    const estimatedWidth = displayFaces.length > 1 ? 500 : 260;
    const estimatedHeight = Math.min(680, window.innerHeight * 0.8);
    const gap = 4;
    const viewportMargin = 16;
    const anchor = preview.anchorRect;
    const point = preview.anchorPoint;

    const rightCandidate = anchor.right + gap;
    const leftCandidate = anchor.left - estimatedWidth - gap;
    const spaceRight = window.innerWidth - viewportMargin - anchor.right;
    const spaceLeft = anchor.left - viewportMargin;

    let left = rightCandidate;
    if (spaceRight < estimatedWidth && spaceLeft >= estimatedWidth) {
      left = leftCandidate;
    } else if (spaceRight >= estimatedWidth && spaceLeft >= estimatedWidth) {
      left = point.x <= anchor.left + anchor.width / 2 ? leftCandidate : rightCandidate;
    } else if (spaceRight < estimatedWidth && spaceLeft < estimatedWidth) {
      left = point.x >= anchor.left + anchor.width / 2 ? leftCandidate : rightCandidate;
    }
    left = Math.max(viewportMargin, Math.min(left, window.innerWidth - estimatedWidth - viewportMargin));

    const preferredTop = point.y - 26;
    const top = Math.max(viewportMargin, Math.min(preferredTop, window.innerHeight - viewportMargin - estimatedHeight));

    return createPortal(
      <DesktopFlyout displayFaces={displayFaces} loadingFaces={isLoading} left={left} top={top} />,
      document.body,
    );
  }

  return createPortal(
    <TouchPreviewModal
      cardName={frontFaceName(preview.name, preview.layout)}
      displayFaces={displayFaces}
      loadingFaces={isLoading}
      touchActions={preview.touchActions}
      onClose={hidePreview}
    />,
    document.body,
  );
}
