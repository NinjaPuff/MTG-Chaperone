import { describe, expect, it } from 'vitest';
import {
  buildSeasonHistory,
  computeCareerStats,
  computeWinRate,
  formatMatchScore,
  resolveMatchResult,
} from '../../services/userProfileService.js';

describe('userProfileService pure helpers', () => {
  describe('computeWinRate', () => {
    it('returns wins divided by total matches', () => {
      expect(computeWinRate(6, 3, 1)).toBe(0.6);
    });

    it('returns 0 when no matches played', () => {
      expect(computeWinRate(0, 0, 0)).toBe(0);
    });
  });

  describe('computeCareerStats', () => {
    it('aggregates standings across seasons', () => {
      const stats = computeCareerStats([
        { matchWins: 3, matchLosses: 1, matchDraws: 0 },
        { matchWins: 2, matchLosses: 2, matchDraws: 1 },
      ]);

      expect(stats).toEqual({
        seasonsPlayed: 2,
        totalMatches: 9,
        matchWins: 5,
        matchLosses: 3,
        matchDraws: 1,
        winRate: 5 / 9,
      });
    });
  });

  describe('buildSeasonHistory', () => {
    it('sorts seasons by number descending and includes rank', () => {
      const rankBySeasonId = new Map([
        ['season-2', 1],
        ['season-1', 4],
      ]);

      const history = buildSeasonHistory(
        [
          {
            seasonId: 'season-1',
            userId: 'user-1',
            points: 9,
            matchWins: 3,
            matchLosses: 1,
            matchDraws: 0,
            omwPercent: 0.5,
            gwPercent: 0.5,
            ogwPercent: 0.5,
            season: { id: 'season-1', number: 1, name: 'Season 1', isActive: false },
          },
          {
            seasonId: 'season-2',
            userId: 'user-1',
            points: 12,
            matchWins: 4,
            matchLosses: 0,
            matchDraws: 0,
            omwPercent: 0.6,
            gwPercent: 0.6,
            ogwPercent: 0.6,
            season: { id: 'season-2', number: 2, name: 'Season 2', isActive: true },
          },
        ],
        rankBySeasonId,
      );

      expect(history.map((row) => row.number)).toEqual([2, 1]);
      expect(history[0].rank).toBe(1);
      expect(history[1].rank).toBe(4);
    });
  });

  describe('formatMatchScore', () => {
    it('formats bye as 2-0', () => {
      expect(
        formatMatchScore('user-1', {
          isBye: true,
          player1Id: 'user-1',
          player2Id: null,
          gameResults: [],
        }),
      ).toBe('2-0');
    });

    it('formats game wins from viewer perspective', () => {
      expect(
        formatMatchScore('user-1', {
          isBye: false,
          player1Id: 'user-1',
          player2Id: 'user-2',
          gameResults: [
            { winnerId: 'user-1', isDraw: false },
            { winnerId: 'user-2', isDraw: false },
            { winnerId: 'user-1', isDraw: false },
          ],
        }),
      ).toBe('2-1');
    });
  });

  describe('resolveMatchResult', () => {
    it('returns win for bye', () => {
      expect(
        resolveMatchResult('user-1', {
          isBye: true,
          player1Id: 'user-1',
          player2Id: null,
          gameResults: [],
        }),
      ).toBe('win');
    });

    it('returns draw when game wins are tied', () => {
      expect(
        resolveMatchResult('user-1', {
          isBye: false,
          player1Id: 'user-1',
          player2Id: 'user-2',
          gameResults: [
            { winnerId: 'user-1', isDraw: false },
            { winnerId: 'user-2', isDraw: false },
          ],
        }),
      ).toBe('draw');
    });
  });
});
