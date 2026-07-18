export function isDeckBuilderPath(pathname: string): boolean {
  return /\/build$/.test(pathname);
}

/** Lets the work area fill remaining flex space instead of a fixed viewport calc. */
export const DECKBUILDER_WORK_AREA_HEIGHT_CLASS = 'lg:min-h-0';
