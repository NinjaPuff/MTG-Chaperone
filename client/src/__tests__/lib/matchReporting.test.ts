import { describe, expect, it } from 'vitest';
import {
  parseGameResultsToCounts,
  toGameResultBody,
  validateReportCounts,
} from '@/lib/matchReporting';

describe('matchReporting', () => {
  describe('validateReportCounts', () => {
    it('requires at least one game', () => {
      expect(validateReportCounts({ player1Wins: 0, player2Wins: 0 }, 3)).toBe(
        'Enter at least one game result before submitting.',
      );
    });

    it('accepts equal wins (match draw)', () => {
      expect(validateReportCounts({ player1Wins: 1, player2Wins: 1 }, 3)).toBeNull();
    });

    it('rejects wins above required', () => {
      expect(validateReportCounts({ player1Wins: 3, player2Wins: 0 }, 3)).toBe(
        'A player cannot exceed 2 wins in best-of-3.',
      );
    });

    it('accepts valid 2-1 result', () => {
      expect(validateReportCounts({ player1Wins: 2, player2Wins: 1 }, 3)).toBeNull();
    });
  });

  describe('toGameResultBody', () => {
    it('builds win-only game results', () => {
      expect(toGameResultBody('p1', 'p2', { player1Wins: 2, player2Wins: 1 })).toEqual([
        { winnerId: 'p1', isDraw: false },
        { winnerId: 'p1', isDraw: false },
        { winnerId: 'p2', isDraw: false },
      ]);
    });
  });

  describe('parseGameResultsToCounts', () => {
    it('ignores legacy draw games', () => {
      expect(
        parseGameResultsToCounts('p1', [
          { winnerId: 'p1', isDraw: false },
          { winnerId: null, isDraw: true },
          { winnerId: 'p2', isDraw: false },
        ]),
      ).toEqual({ player1Wins: 1, player2Wins: 1 });
    });
  });
});
