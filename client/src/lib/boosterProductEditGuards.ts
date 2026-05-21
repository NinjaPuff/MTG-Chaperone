export function hasRemovedSetCodes(originalSetCodes: string[], nextSetCodes: string[]): boolean {
  const next = new Set(nextSetCodes);
  return originalSetCodes.some((code) => !next.has(code));
}
