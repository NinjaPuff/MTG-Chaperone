export type CardImageSize = 'small' | 'normal' | 'border_crop';

const DEFAULT_CARD_IMAGE_PREFERENCE: CardImageSize[] = ['normal', 'border_crop', 'small'];
const FACE_IMAGE_PREFERENCE: CardImageSize[] = ['normal', 'small'];

const cardImageCache = new Map<string, string>();
const inFlightImageUris = new Map<string, Promise<Record<string, string> | null>>();

function normalizeImageUris(imageUris: unknown): Record<string, string> | null {
  if (!imageUris || typeof imageUris !== 'object' || Array.isArray(imageUris)) {
    return null;
  }
  const entries = Object.entries(imageUris as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function buildCandidates(
  imageUris: Record<string, string> | null | undefined,
  preference: CardImageSize[],
) {
  if (!imageUris) {
    return [];
  }
  const ordered: string[] = [];
  for (const size of preference) {
    const value = imageUris[size];
    if (typeof value !== 'string') {
      continue;
    }
    if (!ordered.includes(value)) {
      ordered.push(value);
    }
  }
  return ordered;
}

export function getCardImageCandidates(
  imageUris: Record<string, string> | null | undefined,
  preference: CardImageSize[] = DEFAULT_CARD_IMAGE_PREFERENCE,
) {
  return buildCandidates(imageUris, preference);
}

export function getPrimaryCardImageUrl(
  imageUris: Record<string, string> | null | undefined,
  preference?: CardImageSize[],
) {
  return getCardImageCandidates(imageUris, preference)[0] ?? null;
}

export function getFaceImageCandidates(imageUris: Record<string, string> | null | undefined) {
  return buildCandidates(imageUris, FACE_IMAGE_PREFERENCE);
}

export function getCachedCardImageUrl(scryfallId: string) {
  return cardImageCache.get(scryfallId) ?? null;
}

export function setCachedCardImageUrl(scryfallId: string, url: string | null) {
  if (!url) {
    return;
  }
  cardImageCache.set(scryfallId, url);
}

export async function fetchCardImageUrisOnce(
  scryfallId: string,
  fetcher: (scryfallId: string) => Promise<unknown>,
) {
  const existing = inFlightImageUris.get(scryfallId);
  if (existing) {
    return existing;
  }

  const request = fetcher(scryfallId)
    .then((imageUris) => normalizeImageUris(imageUris))
    .catch(() => null)
    .finally(() => {
      inFlightImageUris.delete(scryfallId);
    });

  inFlightImageUris.set(scryfallId, request);
  return request;
}

export function clearCardImageCachesForTests() {
  cardImageCache.clear();
  inFlightImageUris.clear();
}
