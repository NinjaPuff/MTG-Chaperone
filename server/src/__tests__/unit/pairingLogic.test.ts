import { describe, expect, it } from 'vitest';
import { pairSequential, pairTopVsBottom, rankPlayersByMatchResults } from '../../services/pairingService.js';

describe('pairSequential', () => {
  it('creates adjacent pairs and a bye for odd player count', () => {
    const pairs = pairSequential(['u1', 'u2', 'u3']);

    expect(pairs).toEqual([
      { player1Id: 'u1', player2Id: 'u2', isBye: false },
      { player1Id: 'u3', player2Id: null, isBye: true },
    ]);
  });
});

describe('pairTopVsBottom', () => {
  it('pairs top seed versus bottom seed', () => {
    const pairs = pairTopVsBottom(['u1', 'u2', 'u3', 'u4']);

    expect(pairs).toEqual([
      { player1Id: 'u1', player2Id: 'u4', isBye: false },
      { player1Id: 'u2', player2Id: 'u3', isBye: false },
    ]);
  });
});

describe('rankPlayersByMatchResults', () => {
  it('ranks by match wins then game win percent then fallback order', () => {
    const ranked = rankPlayersByMatchResults(
      ['u1', 'u2', 'u3'],
      [
        {
          isBye: false,
          player1Id: 'u1',
          player2Id: 'u2',
          gameResults: [{ winnerId: 'u1', isDraw: false }, { winnerId: 'u1', isDraw: false }],
        },
        {
          isBye: false,
          player1Id: 'u3',
          player2Id: 'u1',
          gameResults: [{ winnerId: 'u3', isDraw: false }, { winnerId: 'u3', isDraw: false }],
        },
      ],
    );

    expect(ranked).toEqual(['u3', 'u1', 'u2']);
  });

  it('uses fallback input order when match and game records tie', () => {
    const ranked = rankPlayersByMatchResults(
      ['u1', 'u2'],
      [
        {
          isBye: false,
          player1Id: 'u1',
          player2Id: 'u2',
          gameResults: [{ winnerId: null, isDraw: true }],
        },
      ],
    );

    expect(ranked).toEqual(['u1', 'u2']);
  });
});
