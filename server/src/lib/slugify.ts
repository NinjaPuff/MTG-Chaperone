export function slugify(input: string) {
  const value = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return value || 'item';
}

export function withSlugSuffix(baseSlug: string, suffix: string) {
  return `${baseSlug}-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}
