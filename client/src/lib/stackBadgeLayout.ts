/** Top offset for column-level pool badges aligned to each stack slice (not bottom-left). */
export function stackBadgeTopPx(index: number, peekHeight: number, offsetPx = 4): number {
  return index * peekHeight + offsetPx;
}
