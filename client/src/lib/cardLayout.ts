const SINGLE_SIDED_SPLIT_LAYOUTS = new Set(['split', 'flip', 'adventure', 'prepare']);
const DOUBLE_SIDED_LAYOUTS = new Set(['transform', 'modal_dfc', 'double_faced_token', 'reversible_card']);

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

