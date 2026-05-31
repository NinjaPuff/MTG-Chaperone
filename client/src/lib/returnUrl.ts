export const RETURN_URL_STORAGE_KEY = 'mtg_league_return_url';

export function sanitizeReturnUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('/\\') || lower.includes('://') || lower.startsWith('javascript:')) {
    return null;
  }

  return trimmed;
}

export function storeReturnUrl(url: string): void {
  const sanitized = sanitizeReturnUrl(url);
  if (!sanitized) {
    return;
  }

  sessionStorage.setItem(RETURN_URL_STORAGE_KEY, sanitized);
}

export function consumeReturnUrl(): string | null {
  const stored = sessionStorage.getItem(RETURN_URL_STORAGE_KEY);
  sessionStorage.removeItem(RETURN_URL_STORAGE_KEY);
  return sanitizeReturnUrl(stored);
}
