type MatchMediaQuery = Record<string, boolean>;

let originalMatchMedia: typeof window.matchMedia | undefined;

export function mockMatchMedia(queries: MatchMediaQuery) {
  originalMatchMedia = window.matchMedia;

  window.matchMedia = (query: string) => {
    const trimmed = query.trim();
    const matches = queries[trimmed] ?? false;
    return {
      matches,
      media: trimmed,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
}

export function restoreMatchMedia() {
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
    originalMatchMedia = undefined;
  }
}
