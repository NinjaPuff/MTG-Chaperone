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

  it('awards draw stats on tied match', () => {
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
            { winnerId: 'u2', isDraw: false },
          ],
          round: { event: { pointMultiplier: 1 } },
        },
      ],
      { matchWinPoints: 3, matchDrawPoints: 5, matchLossPoints: 0 },
    );

    const u1 = rows.find((row) => row.userId === 'u1');
    const u2 = rows.find((row) => row.userId === 'u2');
    expect(u1?.matchDraws).toBe(1);
    expect(u2?.matchDraws).toBe(1);
    expect(u1?.points).toBe(5);
    expect(u2?.points).toBe(5);
    expect(u1?.matchWins).toBe(0);
    expect(u2?.matchWins).toBe(0);
  });

  it('treats a bye as a 2-0 match win for points and GW%', () => {
    const rows = computeStandings(
      'season-1',
      ['u1', 'u2'],
      [
        {
          isBye: true,
          player1Id: 'u1',
          player2Id: null,
          gameResults: [],
          round: { event: { pointMultiplier: 1 } },
        },
      ],
      { matchWinPoints: 3, matchDrawPoints: 1, matchLossPoints: 0 },
    );

    const u1 = rows.find((row) => row.userId === 'u1');
    const u2 = rows.find((row) => row.userId === 'u2');
    expect(u1).toMatchObject({
      points: 3,
      matchWins: 1,
      gameWins: 2,
      gameLosses: 0,
      gwPercent: 1,
    });
    expect(u1?.omwPercent).toBe(0.33);
    expect(u2?.points).toBe(0);
    expect(u2?.gameWins).toBe(0);
  });

  it('does not double-count a bye that already has 2-0 game results', () => {
    const rows = computeStandings(
      'season-1',
      ['u1'],
      [
        {
          isBye: true,
          player1Id: 'u1',
          player2Id: null,
          gameResults: [
            { winnerId: 'u1', isDraw: false },
            { winnerId: 'u1', isDraw: false },
          ],
          round: { event: { pointMultiplier: 1 } },
        },
      ],
      { matchWinPoints: 3, matchDrawPoints: 1, matchLossPoints: 0 },
    );

    expect(rows[0]).toMatchObject({ gameWins: 2, gameLosses: 0, gwPercent: 1, points: 3 });
  });

  it('ignores the bye round when computing the bye player OMW and includes the bye in their own MWP for opponents', () => {
    const rows = computeStandings(
      'season-1',
      ['u1', 'u2'],
      [
        {
          isBye: true,
          player1Id: 'u1',
          player2Id: null,
          gameResults: [],
          round: { event: { pointMultiplier: 1 } },
        },
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
    expect(u1?.matchWins).toBe(2);
    expect(u1?.gameWins).toBe(4);
    expect(u1?.omwPercent).toBe(0.33);
    expect(u2?.omwPercent).toBe(1);
  });
});
