export function isDeckBuilderPath(pathname: string): boolean {
  return /\/build$/.test(pathname);
}

export const DECKBUILDER_WORK_AREA_HEIGHT_CLASS = 'lg:h-[calc(100dvh-9rem)]';
