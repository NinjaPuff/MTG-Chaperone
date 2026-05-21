export function stackVisibleFaceHeight(index: number, cardCount: number, peekHeight: number, cardHeight: number): number {
  return index === cardCount - 1 ? cardHeight : peekHeight;
}

export function stackBadgeTopPx(index: number, cardCount: number, peekHeight: number, cardHeight: number): number {
  return index * peekHeight + stackVisibleFaceHeight(index, cardCount, peekHeight, cardHeight);
}
