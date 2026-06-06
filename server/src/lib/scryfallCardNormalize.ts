export function isPaperPrinting(card: { digital?: boolean; games?: string[] }): boolean {
  if (card.digital) {
    return false;
  }

  const games = card.games ?? ['paper'];
  return games.includes('paper');
}

export function resolveTypeLine(card: {
  type_line?: string;
  card_faces?: Array<{ type_line?: string }>;
}): string {
  const top = card.type_line?.trim();
  if (top) {
    return top;
  }

  for (const face of card.card_faces ?? []) {
    const faceType = face.type_line?.trim();
    if (faceType) {
      return faceType;
    }
  }

  return 'Card';
}
