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

export function isLandTypeLine(typeLine: string): boolean {
  return /\bLand\b/i.test(typeLine);
}

export function resolveCmc(card: {
  cmc?: number;
  card_faces?: Array<{ cmc?: number }>;
}): number {
  if (typeof card.cmc === 'number') {
    return card.cmc;
  }

  for (const face of card.card_faces ?? []) {
    if (typeof face.cmc === 'number') {
      return face.cmc;
    }
  }

  return 0;
}

export function needsFaceCmcRefresh(card: {
  name: string;
  layout: string | null;
  manaCost: string | null;
  cmc: number;
  typeLine: string;
}): boolean {
  if (card.manaCost === null && card.cmc > 0 && card.name.includes('//')) {
    return true;
  }

  return card.layout === 'reversible_card' && card.cmc === 0 && !isLandTypeLine(card.typeLine);
}
