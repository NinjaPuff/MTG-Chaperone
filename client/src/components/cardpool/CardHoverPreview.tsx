import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { useCardPreview } from './CardPreviewContext';

type CardFace = {
  name: string;
  imageUris: Record<string, string> | null;
};

type CardFacesResponse = {
  data: {
    faces: CardFace[];
  };
};

const facesCache = new Map<string, CardFace[]>();

function supportsHover() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(hover: hover)').matches;
}

function getFaceImage(face: CardFace): string | null {
  if (!face.imageUris) {
    return null;
  }
  const url = face.imageUris.normal ?? face.imageUris.small ?? null;
  return typeof url === 'string' ? url : null;
}

export function CardHoverPreview() {
  const { preview } = useCardPreview();
  const [isHoverCapable, setIsHoverCapable] = useState(supportsHover);
  const [faces, setFaces] = useState<CardFace[] | null>(null);
  const [loadingFaces, setLoadingFaces] = useState(false);

  useEffect(() => {
    setIsHoverCapable(supportsHover());
  }, []);

  useEffect(() => {
    if (!preview || !preview.name.includes(' // ')) {
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

  const displayFaces = useMemo(() => {
    if (!preview) {
      return [];
    }
    if (faces && faces.length > 0) {
      return faces;
    }
    return [
      {
        name: preview.name,
        imageUris: preview.imageUrl ? { normal: preview.imageUrl } : null,
      },
    ];
  }, [faces, preview]);

  if (!preview || !isHoverCapable || typeof document === 'undefined') {
    return null;
  }

  const estimatedWidth = displayFaces.length > 1 ? 500 : 260;
  const gap = 12;
  const viewportMargin = 16;
  const anchor = preview.anchorRect;

  let left = anchor.right + gap;
  if (left + estimatedWidth > window.innerWidth - viewportMargin) {
    left = anchor.left - estimatedWidth - gap;
  }
  left = Math.max(viewportMargin, Math.min(left, window.innerWidth - estimatedWidth - viewportMargin));

  const top = Math.max(
    viewportMargin,
    Math.min(anchor.top, window.innerHeight - viewportMargin - Math.min(680, window.innerHeight * 0.8)),
  );

  return createPortal(
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
    </div>,
    document.body,
  );
}
