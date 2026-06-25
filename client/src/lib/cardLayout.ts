const SINGLE_SIDED_SPLIT_LAYOUTS = new Set(['split', 'flip', 'adventure', 'prepare']);
const DOUBLE_SIDED_LAYOUTS = new Set(['transform', 'modal_dfc', 'double_faced_token', 'reversible_card']);
/** Scryfall portrait scans with landscape-oriented card content (rotate 90° clockwise). */
const LANDSCAPE_CARD_LAYOUTS = new Set(['split']);

export function isLandscapeCardLayout(layout: string | null): boolean {
  return Boolean(layout && LANDSCAPE_CARD_LAYOUTS.has(layout));
}

export function isBattleTypeLine(typeLine: string | null): boolean {
  return Boolean(typeLine?.includes('Battle'));
}

export function isLandscapeCardFace(
  cardLayout: string | null,
  faceTypeLine: string | null,
): boolean {
  return isLandscapeCardLayout(cardLayout) || isBattleTypeLine(faceTypeLine);
}

/** Portrait-oriented Scryfall scans that represent a landscape card face. */
export function needsImageRotation(
  cardLayout: string | null,
  faceTypeLine: string | null,
): boolean {
  return isLandscapeCardFace(cardLayout, faceTypeLine);
}

export function faceTypeLineFromCard(cardTypeLine: string | null, faceIndex: number): string | null {
  if (!cardTypeLine || !cardTypeLine.includes(' // ')) {
    return faceIndex === 0 ? cardTypeLine : null;
  }

  const parts = cardTypeLine.split(' // ').map((part) => part.trim());
  if (faceIndex === 0) {
    return parts[0] || cardTypeLine;
  }
  if (faceIndex === 1) {
    return parts[1] || null;
  }
  return cardTypeLine;
}

/** Layout token for card thumbnails (grid/stacks) using card-level typeLine. */
export function cardThumbnailLayoutToken(
  cardLayout: string | null,
  cardTypeLine: string | null,
): string | null {
  return isLandscapeCardFace(cardLayout, cardTypeLine) ? 'split' : cardLayout;
}

export function cardImageAspectClassName(layout: string | null): string {
  const base = 'w-full rounded-md border border-border';
  if (isLandscapeCardLayout(layout)) {
    return `${base} aspect-[680/488] bg-muted/40 object-contain object-center`;
  }
  return `${base} aspect-[488/680] object-cover`;
}

export function cardImageFallbackClassName(layout: string | null): string {
  const base =
    'w-full rounded-md border border-border bg-muted p-2 text-center text-xs text-muted-foreground';
  return isLandscapeCardLayout(layout) ? `${base} aspect-[680/488]` : `${base} aspect-[488/680]`;
}

export function cardHoverPreviewImageClassName(
  _layout: string | null,
  variant: 'desktop' | 'touch' = 'desktop',
): string {
  return variant === 'touch'
    ? 'max-h-[55vh] w-auto max-w-[360px] rounded-md border border-border object-contain'
    : 'max-h-[80vh] w-auto max-w-[360px] rounded-md border border-border object-contain';
}

export function cardHoverPreviewLandscapeFrameClassName(
  variant: 'desktop' | 'touch' = 'desktop',
): string {
  const size =
    variant === 'touch'
      ? 'h-[min(55vh,400px)] w-[min(92vw,660px)]'
      : 'h-[min(60vh,440px)] w-[min(92vw,660px)]';
  return `relative ${size} max-w-full shrink-0 overflow-hidden rounded-md border border-border bg-muted/40`;
}

/** Portrait-oriented Scryfall scan; rotate 90° clockwise to read as a landscape card. */
export function cardHoverPreviewLandscapeImageClassName(): string {
  return cardImageLandscapeRotationClassName();
}

export function cardImageLandscapeFrameClassName(): string {
  return 'relative w-full overflow-hidden rounded-md border border-border bg-muted/40 aspect-[680/488]';
}

export function cardImageLandscapeRotationClassName(): string {
  return 'absolute left-1/2 top-1/2 max-h-[145%] w-auto -translate-x-1/2 -translate-y-1/2 rotate-90 object-contain';
}

export function cardHoverPreviewFallbackClassName(isLandscape: boolean): string {
  if (isLandscape) {
    return 'flex h-[280px] w-[560px] max-w-full items-center justify-center rounded-md border border-border bg-muted p-3 text-center text-xs text-muted-foreground';
  }
  return 'flex h-[504px] w-[360px] items-center justify-center rounded-md border border-border bg-muted p-3 text-center text-xs text-muted-foreground';
}

export function cardHoverPreviewDialogClassName(hasLandscapeFace: boolean): string {
  const base =
    'relative flex max-h-[90vh] w-full flex-col gap-3 overflow-y-auto rounded-t-xl border border-border bg-card p-4 shadow-lg sm:rounded-xl';
  if (hasLandscapeFace) {
    return `${base} max-w-2xl`;
  }
  return `${base} max-w-md sm:max-w-lg`;
}

export function isDoubleSidedLayout(layout: string | null): boolean {
  return Boolean(layout && DOUBLE_SIDED_LAYOUTS.has(layout));
}

export function isSingleSidedSplitLayout(layout: string | null): boolean {
  return Boolean(layout && SINGLE_SIDED_SPLIT_LAYOUTS.has(layout));
}

export function frontFaceName(name: string, layout: string | null): string {
  if (!isSingleSidedSplitLayout(layout)) {
    return name;
  }

  const separatorIndex = name.indexOf(' // ');
  if (separatorIndex === -1) {
    return name;
  }

  return name.slice(0, separatorIndex).trim() || name;
}

export function frontFaceManaCost(manaCost: string | null, layout: string | null): string | null {
  if (!manaCost || !isSingleSidedSplitLayout(layout)) {
    return manaCost;
  }

  const separatorIndex = manaCost.indexOf(' // ');
  if (separatorIndex === -1) {
    return manaCost;
  }

  const front = manaCost.slice(0, separatorIndex).trim();
  return front || manaCost;
}
