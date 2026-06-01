export function resolveKofiSupportUrl(envValue: string | undefined): string | null {
  const trimmed = envValue?.trim();
  return trimmed ? trimmed : null;
}
