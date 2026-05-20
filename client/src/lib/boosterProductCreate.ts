export function resolveCreatePrimarySetCode(
  seedSet: string[],
  setCodes: string[],
): string | undefined {
  const seed = seedSet[0]?.trim().toUpperCase();
  if (!seed) {
    return undefined;
  }

  const normalizedCodes = new Set(setCodes.map((code) => code.trim().toUpperCase()).filter(Boolean));
  if (!normalizedCodes.has(seed)) {
    return undefined;
  }

  return seed;
}
