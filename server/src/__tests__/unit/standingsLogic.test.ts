import { describe, expect, it } from 'vitest';
import { computeStandings, floorWinPercent } from '../../services/standingsService.js';

describe('floorWinPercent', () => {
  it('floors percentages at 0.33', () => {
    expect(floorWinPercent(0.1)).toBe(0.33);
    expect(floorWinPercent(0.8)).toBe(0.8);
  });
});

describe('computeStandings', () => {
  it('computes points, match records, and tiebreak metrics', () => {
    const rows = computeStandings(
      'season-1',
      ['u1', 'u2'],
      [
        {
          isBye: false,
          player1Id: 'u1',
          player2Id: 'u2',
          gameResults: [
            { winnerId: 'u1', isDraw: false },
            { winnerId: 'u1', isDraw: false },
          ],
          round: { event: { pointMultiplier: 1 } },
        },
      ],
      { matchWinPoints: 3, matchDrawPoints: 1, matchLossPoints: 0 },
    );

    const u1 = rows.find((row) => row.userId === 'u1');
    const u2 = rows.find((row) => row.userId === 'u2');
    expect(rows).toHaveLength(2);
    expect(u1?.points).toBe(3);
    expect(u1?.matchWins).toBe(1);
    expect(u1?.gameWins).toBe(2);
    expect(u1?.gameLosses).toBe(0);
    expect(u2?.points).toBe(0);
    expect(u2?.matchLosses).toBe(1);
    expect(u2?.gameWins).toBe(0);
    expect(u2?.gameLosses).toBe(2);
    expect(u1?.gwPercent).toBeGreaterThanOrEqual(0.33);
    expect(u2?.gwPercent).toBeGreaterThanOrEqual(0.33);
    expect(u1?.omwPercent).toBe(0.33);
    expect(u2?.omwPercent).toBe(1);
  });
});
