import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { apiRequest } from '@/lib/api';
import {
  fetchCardImageUrisOnce,
  getCachedCardImageUrl,
  getCardImageCandidates,
  setCachedCardImageUrl,
  type CardImageSize,
} from '@/lib/cardImage';

type PoolCardImageProps = {
  imageUris: Record<string, string> | null;
  name: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  loading?: 'eager' | 'lazy';
  preference?: CardImageSize[];
  fallbackClassName?: string;
  scryfallId?: string;
  'data-testid'?: string;
};

function mergeCandidates(base: string[], additions: string[]) {
  const merged = [...base];
  for (const value of additions) {
    if (!merged.includes(value)) {
      merged.push(value);
    }
  }
  return merged;
}

export function PoolCardImage({
  imageUris,
  name,
  alt,
  className,
  style,
  loading = 'lazy',
  preference,
  fallbackClassName,
  scryfallId,
  'data-testid': dataTestId = 'pool-card-image',
}: PoolCardImageProps) {
  const localCandidates = useMemo(() => getCardImageCandidates(imageUris, preference), [imageUris, preference]);
  const [candidates, setCandidates] = useState<string[]>(localCandidates);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const hasTriedRefreshRef = useRef(false);

  useEffect(() => {
    const cached = scryfallId ? getCachedCardImageUrl(scryfallId) : null;
    const merged = cached ? mergeCandidates([cached], localCandidates) : localCandidates;
    setCandidates(merged);
    setCandidateIndex(0);
    hasTriedRefreshRef.current = false;
  }, [localCandidates, scryfallId]);

  useEffect(() => {
    if (candidateIndex < candidates.length || !scryfallId || hasTriedRefreshRef.current) {
      return;
    }
    hasTriedRefreshRef.current = true;

    void fetchCardImageUrisOnce(scryfallId, async (cardId) => {
      const response = await apiRequest<{ data: { imageUris: Record<string, string> | null } }>(`/api/cards/${cardId}`);
      return response.data.imageUris;
    }).then((freshImageUris) => {
      if (!freshImageUris) {
        return;
      }
      const nextCandidates = getCardImageCandidates(freshImageUris, preference);
      if (nextCandidates.length === 0) {
        return;
      }
      setCachedCardImageUrl(scryfallId, nextCandidates[0]);
      setCandidates((prev) => mergeCandidates(prev, nextCandidates));
    });
  }, [candidateIndex, candidates.length, preference, scryfallId]);

  const src = candidates[candidateIndex] ?? null;
  if (!src) {
    return (
      <div className={fallbackClassName} style={style}>
        {name}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? name}
      className={className}
      style={style}
      loading={loading}
      decoding="async"
      onError={() => setCandidateIndex((prev) => prev + 1)}
      data-testid={dataTestId}
    />
  );
}
