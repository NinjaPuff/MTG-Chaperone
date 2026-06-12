export type ActiveMatchPlayer = {
  id: string;
};

export type ActiveMatchLike = {
  id: string;
  status: string;
  reportedById: string | null;
  player1: ActiveMatchPlayer;
  player2: ActiveMatchPlayer | null;
};

export type ActiveRoundLike = {
  roundNumber: number;
  status: string;
  matches: ActiveMatchLike[];
};

const FINISHED_STATUSES = new Set(['confirmed', 'resolved']);

export function getUserActiveMatches<TMatch extends ActiveMatchLike, TRound extends ActiveRoundLike & { matches: TMatch[] }>(
  rounds: TRound[],
  userId: string | undefined,
): Array<{ match: TMatch; round: TRound }> {
  if (!userId) {
    return [];
  }

  const results: Array<{ match: TMatch; round: TRound }> = [];

  for (const round of rounds) {
    if (round.status !== 'in_progress') {
      continue;
    }
    for (const match of round.matches) {
      if (FINISHED_STATUSES.has(match.status)) {
        continue;
      }
      const isParticipant = match.player1.id === userId || match.player2?.id === userId;
      if (!isParticipant) {
        continue;
      }
      if (match.status === 'reported' && match.reportedById === userId) {
        continue;
      }
      results.push({ match, round });
    }
  }

  return results.sort((a, b) => a.round.roundNumber - b.round.roundNumber);
}
