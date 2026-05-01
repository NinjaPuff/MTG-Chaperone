import { MatchRecord } from '@/components/MatchCard';

type GameResultLike = {
  winnerId: string | null;
  isDraw: boolean;
};

type MatchLike = {
  status: 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
  isBye: boolean;
  player1: { id: string };
  player2: { id: string } | null;
  gameResults: GameResultLike[];
};

type RoundLike<TMatch extends MatchLike> = {
  matches: TMatch[];
};

function ensureRecord(records: Map<string, MatchRecord>, userId: string): MatchRecord {
  const existing = records.get(userId);
  if (existing) {
    return existing;
  }
  const next = { wins: 0, losses: 0, draws: 0 };
  records.set(userId, next);
  return next;
}

export function computeEventRecords<TMatch extends MatchLike>(rounds: Array<RoundLike<TMatch>>): Map<string, MatchRecord> {
  const records = new Map<string, MatchRecord>();

  for (const round of rounds) {
    for (const match of round.matches) {
      ensureRecord(records, match.player1.id);
      if (match.player2) {
        ensureRecord(records, match.player2.id);
      }

      if (!['confirmed', 'resolved'].includes(match.status)) {
        continue;
      }

      const p1Record = ensureRecord(records, match.player1.id);

      if (match.isBye || !match.player2) {
        p1Record.wins += 1;
        continue;
      }

      const p2Record = ensureRecord(records, match.player2.id);
      let p1Wins = 0;
      let p2Wins = 0;
      for (const game of match.gameResults) {
        if (game.isDraw || !game.winnerId) {
          continue;
        }
        if (game.winnerId === match.player1.id) {
          p1Wins += 1;
        } else if (game.winnerId === match.player2.id) {
          p2Wins += 1;
        }
      }

      if (p1Wins > p2Wins) {
        p1Record.wins += 1;
        p2Record.losses += 1;
      } else if (p2Wins > p1Wins) {
        p2Record.wins += 1;
        p1Record.losses += 1;
      } else {
        p1Record.draws += 1;
        p2Record.draws += 1;
      }
    }
  }

  return records;
}
