type MatchLike = {
  status: string;
  reportedById: string | null;
  player1: { id: string };
  player2: { id: string } | null;
};

type RoundLike = {
  status: string;
};

export type BracketMatchInteraction = 'report' | 'resolve' | null;

export function getBracketMatchInteraction(
  match: MatchLike,
  round: RoundLike,
  userId: string | undefined,
  isAdmin: boolean,
): BracketMatchInteraction {
  const isParticipant = Boolean(userId && (match.player1.id === userId || match.player2?.id === userId));

  if (isAdmin && match.status === 'disputed') {
    return 'resolve';
  }

  if ((isParticipant || isAdmin) && match.status === 'pending' && round.status === 'in_progress') {
    return 'report';
  }

  return null;
}

export function isBracketMatchClickable(
  match: MatchLike,
  round: RoundLike,
  userId: string | undefined,
  isAdmin: boolean,
) {
  return getBracketMatchInteraction(match, round, userId, isAdmin) !== null;
}
