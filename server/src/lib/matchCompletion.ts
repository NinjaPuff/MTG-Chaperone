export function playerHasFinishedEventMatches(
  matches: Array<{ status: string }>,
): boolean {
  if (matches.length < 1) {
    return false;
  }
  return matches.every((match) => match.status === 'confirmed' || match.status === 'resolved');
}
