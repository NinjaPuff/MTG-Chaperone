export const MIN_DECK_SIZES = [40, 60] as const;
export type MinDeckSize = (typeof MIN_DECK_SIZES)[number];

export function minDeckSizeSelectOptions(current: number): Array<{ value: number; label: string }> {
  const options = MIN_DECK_SIZES.map((size) => ({ value: size, label: String(size) }));
  if (current === 40 || current === 60) {
    return options;
  }
  return [{ value: current, label: `${current} (pick 40 or 60)` }, ...options];
}
