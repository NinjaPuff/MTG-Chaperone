import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import {
  fetchCardImageUrisOnce,
  getCachedCardImageUrl,
  getFaceImageCandidates,
  getPrimaryCardImageUrl,
  setCachedCardImageUrl,
} from '@/lib/cardImage';
import {
  cardHoverPreviewDialogClassName,
  cardHoverPreviewFallbackClassName,
  cardHoverPreviewImageClassName,
  cardHoverPreviewLandscapeFrameClassName,
  cardHoverPreviewLandscapeImageClassName,
  faceTypeLineFromCard,
  frontFaceName,
  isDoubleSidedLayout,
  isLandscapeCardFace,
  needsImageRotation,
} from '@/lib/cardLayout';
import { deviceHasHover, useCardPreview } from './CardPreviewContext';

type CardFace = {
  name: string;
  typeLine?: string | null;
  imageUris: Record<string, string> | null;
};

type CardFacesResponse = {
  data: {
    faces: CardFace[];
  };
};

type CardResponse = {
  data: {
    layout: string | null;
    imageUris: Record<string, string> | null;
  };
};

const facesCache = new Map<string, CardFace[]>();
const layoutCache = new Map<string, string | null>();

export function clearCardHoverPreviewCachesForTests() {
  facesCache.clear();
  layoutCache.clear();
}

function hasLandscapePreviewFace(cardLayout: string | null, displayFaces: CardFace[]): boolean {
  return displayFaces.some((face) => isLandscapeCardFace(cardLayout, face.typeLine ?? null));
}

function enrichFaceTypeLines(faces: CardFace[], cardTypeLine: string | null): CardFace[] {
  return faces.map((face, index) => ({
    ...face,
    typeLine: face.typeLine ?? faceTypeLineFromCard(cardTypeLine, index),
  }));
}

function PreviewFace({
  face,
  imageClassName,
  fallbackClassName,
  rotateLandscape = false,
  variant = 'desktop',
}: {
  face: CardFace;
  imageClassName: string;
  fallbackClassName: string;
  rotateLandscape?: boolean;
  variant?: 'desktop' | 'touch';
}) {
  const candidates = useMemo(() => getFaceImageCandidates(face.imageUris), [face.imageUris]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [face.name, candidates]);

  const image = candidates[candidateIndex] ?? null;
  if (!image) {
    if (rotateLandscape) {
      return (
        <div className={cardHoverPreviewLandscapeFrameClassName(variant)}>
          <div className={fallbackClassName}>{face.name}</div>
        </div>
      );
    }
    return <div className={fallbackClassName}>{face.name}</div>;
  }

  const img = (
    <img
      src={image}
      alt={face.name}
      className={imageClassName}
      onError={() => setCandidateIndex((prev) => prev + 1)}
    />
  );

  if (rotateLandscape) {
    return <div className={cardHoverPreviewLandscapeFrameClassName(variant)}>{img}</div>;
  }

  return img;
}

function DesktopFlyout({
  displayFaces,
  loadingFaces,
  cardLayout,
  left,
  top,
}: {
  displayFaces: CardFace[];
  loadingFaces: boolean;
  cardLayout: string | null;
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
          const rotateLandscape = needsImageRotation(cardLayout, face.typeLine ?? null);
          return (
            <PreviewFace
              key={`${face.name}-${index}`}
              face={face}
              rotateLandscape={rotateLandscape}
              variant="desktop"
              imageClassName={
                rotateLandscape
                  ? cardHoverPreviewLandscapeImageClassName()
                  : cardHoverPreviewImageClassName(null, 'desktop')
              }
              fallbackClassName={cardHoverPreviewFallbackClassName(rotateLandscape)}
            />
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
  cardLayout,
  touchActions,
  onClose,
}: {
  cardName: string;
  displayFaces: CardFace[];
  loadingFaces: boolean;
  cardLayout: string | null;
  touchActions: { label: string; onAction: () => void }[];
  onClose: () => void;
}) {
  const hasLandscapeFace = hasLandscapePreviewFace(cardLayout, displayFaces);
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
        className={cardHoverPreviewDialogClassName(hasLandscapeFace)}
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
            const rotateLandscape = needsImageRotation(cardLayout, face.typeLine ?? null);
            return (
              <PreviewFace
                key={`${face.name}-${index}`}
                face={face}
                rotateLandscape={rotateLandscape}
                variant="touch"
                imageClassName={
                  rotateLandscape
                    ? cardHoverPreviewLandscapeImageClassName()
                    : cardHoverPreviewImageClassName(null, 'touch')
                }
                fallbackClassName={cardHoverPreviewFallbackClassName(rotateLandscape)}
              />
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
  const [resolvedLayout, setResolvedLayout] = useState<string | null>(null);

  useEffect(() => {
    setIsHoverCapable(deviceHasHover());
  }, []);

  useEffect(() => {
    if (!preview) {
      setResolvedLayout(null);
      return;
    }

    if (preview.layout) {
      setResolvedLayout(null);
      return;
    }

    const cachedLayout = layoutCache.get(preview.scryfallId);
    if (cachedLayout !== undefined) {
      setResolvedLayout(cachedLayout);
      return;
    }

    if (!preview.imageUrl) {
      return;
    }

    if (!preview.name.includes(' // ')) {
      return;
    }

    let cancelled = false;
    setResolvedLayout(null);

    void apiRequest<CardResponse>(`/api/cards/${preview.scryfallId}`)
      .then((response) => {
        if (cancelled) {
          return;
        }
        const layout = response.data.layout ?? null;
        layoutCache.set(preview.scryfallId, layout);
        setResolvedLayout(layout);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedLayout(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preview]);

  const cardLayout = preview?.layout ?? resolvedLayout;

  useEffect(() => {
    if (!preview || !isDoubleSidedLayout(cardLayout)) {
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
  }, [preview, cardLayout]);

  useEffect(() => {
    if (!preview) {
      setResolvedImageUrl(null);
      setLoadingImage(false);
      return;
    }

    if (preview.imageUrl) {
      setResolvedImageUrl(preview.imageUrl);
      setCachedCardImageUrl(preview.scryfallId, preview.imageUrl);
      setLoadingImage(false);
      return;
    }

    const cachedImage = getCachedCardImageUrl(preview.scryfallId);
    if (cachedImage) {
      setResolvedImageUrl(cachedImage);
      setLoadingImage(false);
      return;
    }

    let cancelled = false;
    setLoadingImage(true);
    setResolvedImageUrl(null);

    void fetchCardImageUrisOnce(preview.scryfallId, async (scryfallId) => {
      const response = await apiRequest<CardResponse>(`/api/cards/${scryfallId}`);
      layoutCache.set(scryfallId, response.data.layout ?? null);
      return response.data.imageUris;
    })
      .then((imageUris) => {
        if (cancelled) {
          return;
        }
        const layout = layoutCache.get(preview.scryfallId);
        if (layout !== undefined) {
          setResolvedLayout(layout);
        }
        const imageUrl = getPrimaryCardImageUrl(imageUris, ['normal', 'small', 'border_crop']);
        if (imageUrl) {
          setCachedCardImageUrl(preview.scryfallId, imageUrl);
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
    const displayName = frontFaceName(preview.name, cardLayout);
    const cardTypeLine = preview.typeLine ?? null;
    if (faces && faces.length > 0) {
      return enrichFaceTypeLines(faces, cardTypeLine);
    }
    return [
      {
        name: displayName,
        typeLine: faceTypeLineFromCard(cardTypeLine, 0) ?? cardTypeLine,
        imageUris: resolvedImageUrl ? { normal: resolvedImageUrl } : null,
      },
    ];
  }, [faces, preview, resolvedImageUrl, cardLayout]);

  if (!preview || typeof document === 'undefined') {
    return null;
  }

  const isLoading = loadingFaces || loadingImage;
  const useDesktopFlyout = isHoverCapable && !preview.isTouchMode;

  if (useDesktopFlyout) {
    const hasLandscapeFace = hasLandscapePreviewFace(cardLayout, displayFaces);
    const singleLandscapeFace = displayFaces.length === 1 && hasLandscapeFace;
    const estimatedWidth = displayFaces.length > 1 ? 680 : singleLandscapeFace ? 660 : 380;
    const estimatedHeight = singleLandscapeFace
      ? Math.min(440, window.innerHeight * 0.6)
      : Math.min(680, window.innerHeight * 0.8);
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
      <DesktopFlyout
        displayFaces={displayFaces}
        loadingFaces={isLoading}
        cardLayout={cardLayout}
        left={left}
        top={top}
      />,
      document.body,
    );
  }

  return createPortal(
    <TouchPreviewModal
      cardName={frontFaceName(preview.name, cardLayout)}
      displayFaces={displayFaces}
      loadingFaces={isLoading}
      cardLayout={cardLayout}
      touchActions={preview.touchActions}
      onClose={hidePreview}
    />,
    document.body,
  );
}
