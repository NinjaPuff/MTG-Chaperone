export type MatchInputCounts = {
  player1Wins: number;
  player2Wins: number;
};

export type GameResultInput = {
  winnerId: string | null;
  isDraw?: boolean;
};

export function validateReportCounts(counts: MatchInputCounts, bestOfN: number): string | null {
  if (
    !Number.isInteger(counts.player1Wins) ||
    !Number.isInteger(counts.player2Wins)
  ) {
    return 'Wins must be whole numbers.';
  }

  const totalWins = counts.player1Wins + counts.player2Wins;
  const requiredWins = Math.ceil(bestOfN / 2);

  if (totalWins === 0) {
    return 'Enter at least one game result before submitting.';
  }
  if (totalWins > bestOfN) {
    return `Total wins cannot exceed best-of-${bestOfN}.`;
  }
  if (counts.player1Wins > requiredWins || counts.player2Wins > requiredWins) {
    return `A player cannot exceed ${requiredWins} wins in best-of-${bestOfN}.`;
  }

  return null;
}

export function toGameResultBody(
  player1Id: string,
  player2Id: string,
  counts: MatchInputCounts,
): Array<{ winnerId: string; isDraw: false }> {
  const gameResults: Array<{ winnerId: string; isDraw: false }> = [];
  for (let i = 0; i < counts.player1Wins; i += 1) {
    gameResults.push({ winnerId: player1Id, isDraw: false });
  }
  for (let i = 0; i < counts.player2Wins; i += 1) {
    gameResults.push({ winnerId: player2Id, isDraw: false });
  }
  return gameResults;
}

export function parseGameResultsToCounts(
  player1Id: string,
  gameResults: GameResultInput[],
): MatchInputCounts {
  let player1Wins = 0;
  let player2Wins = 0;

  for (const game of gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === player1Id) {
      player1Wins += 1;
    } else {
      player2Wins += 1;
    }
  }

  return { player1Wins, player2Wins };
}
