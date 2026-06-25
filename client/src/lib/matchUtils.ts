export type GameResult = {
  winnerId: string | null;
  isDraw: boolean;
};

export type MatchOutcome = 'player1' | 'player2' | 'draw' | null;

export function getMatchOutcome(
  status: string,
  player1Id: string,
  player2Id: string | null,
  gameResults: GameResult[],
): MatchOutcome {
  if (!['reported', 'confirmed', 'resolved'].includes(status) || !player2Id) {
    return null;
  }

  let p1Wins = 0;
  let p2Wins = 0;

  for (const game of gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === player1Id) {
      p1Wins += 1;
      continue;
    }
    if (game.winnerId === player2Id) {
      p2Wins += 1;
    }
  }

  if (p1Wins === p2Wins) {
    return gameResults.length > 0 ? 'draw' : null;
  }

  return p1Wins > p2Wins ? 'player1' : 'player2';
}

export function computeMatchRecord(playerId: string, gameResults: GameResult[]) {
  let wins = 0;
  let losses = 0;

  for (const game of gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === playerId) {
      wins += 1;
      continue;
    }
    losses += 1;
  }

  return { wins, losses };
}
