import { describe, expect, it } from 'vitest';
import { pairSequential, pairSwissScoreGroups, pairTopVsBottom, rankPlayersByMatchResults } from '../../services/pairingService.js';

describe('pairSequential', () => {
  it('returns empty when no players', () => {
    expect(pairSequential([])).toEqual([]);
  });

  it('gives single player a bye', () => {
    expect(pairSequential(['u1'])).toEqual([{ player1Id: 'u1', player2Id: null, isBye: true }]);
  });

  it('pairs adjacent players for even player counts', () => {
    const pairs = pairSequential(['u1', 'u2', 'u3', 'u4']);

    expect(pairs).toEqual([
      { player1Id: 'u1', player2Id: 'u2', isBye: false },
      { player1Id: 'u3', player2Id: 'u4', isBye: false },
    ]);
  });

  it('creates adjacent pairs and a bye for odd player count', () => {
    const pairs = pairSequential(['u1', 'u2', 'u3']);

    expect(pairs).toEqual([
      { player1Id: 'u1', player2Id: 'u2', isBye: false },
      { player1Id: 'u3', player2Id: null, isBye: true },
    ]);
  });
});

describe('pairTopVsBottom', () => {
  it('returns empty when no players', () => {
    expect(pairTopVsBottom([])).toEqual([]);
  });

  it('gives single player a bye', () => {
    expect(pairTopVsBottom(['u1'])).toEqual([{ player1Id: 'u1', player2Id: null, isBye: true }]);
  });

  it('pairs top seed versus bottom seed', () => {
    const pairs = pairTopVsBottom(['u1', 'u2', 'u3', 'u4']);

    expect(pairs).toEqual([
      { player1Id: 'u1', player2Id: 'u4', isBye: false },
      { player1Id: 'u2', player2Id: 'u3', isBye: false },
    ]);
  });

  it('pairs first versus last and gives middle player a bye for odd counts', () => {
    const pairs = pairTopVsBottom(['u1', 'u2', 'u3', 'u4', 'u5']);

    expect(pairs).toEqual([
      { player1Id: 'u1', player2Id: 'u5', isBye: false },
      { player1Id: 'u2', player2Id: 'u4', isBye: false },
      { player1Id: 'u3', player2Id: null, isBye: true },
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

  it('counts bye matches as match wins', () => {
    const ranked = rankPlayersByMatchResults(
      ['u1', 'u2'],
      [{ isBye: true, player1Id: 'u1', player2Id: null, gameResults: [] }],
    );

    expect(ranked).toEqual(['u1', 'u2']);
  });

  it('awards a match win when player2 is null', () => {
    const ranked = rankPlayersByMatchResults(
      ['u1', 'u2'],
      [{ isBye: false, player1Id: 'u1', player2Id: null, gameResults: [] }],
    );

    expect(ranked).toEqual(['u1', 'u2']);
  });

  it('excludes draws from game win percent when match wins tie', () => {
    const ranked = rankPlayersByMatchResults(
      ['u1', 'u2', 'u3', 'u4'],
      [
        {
          isBye: false,
          player1Id: 'u1',
          player2Id: 'u2',
          gameResults: [
            { winnerId: 'u1', isDraw: false },
            { winnerId: 'u1', isDraw: false },
            { winnerId: null, isDraw: true },
          ],
        },
        {
          isBye: false,
          player1Id: 'u3',
          player2Id: 'u4',
          gameResults: [
            { winnerId: 'u3', isDraw: false },
            { winnerId: 'u3', isDraw: false },
            { winnerId: 'u4', isDraw: false },
          ],
        },
      ],
    );

    expect(ranked).toEqual(['u1', 'u3', 'u4', 'u2']);
  });

  it('skips matches whose player1 is not in the field', () => {
    const ranked = rankPlayersByMatchResults(
      ['u1', 'u2'],
      [
        {
          isBye: false,
          player1Id: 'ux',
          player2Id: 'u1',
          gameResults: [{ winnerId: 'ux', isDraw: false }],
        },
      ],
    );

    expect(ranked).toEqual(['u1', 'u2']);
  });
});

describe('pairSwissScoreGroups', () => {
  it('returns empty when no players', () => {
    expect(pairSwissScoreGroups([], new Set(), new Set())).toEqual([]);
  });

  it('gives single player a bye', () => {
    expect(pairSwissScoreGroups([{ userId: 'A', points: 6 }], new Set(), new Set())).toEqual([
      { player1Id: 'A', player2Id: null, isBye: true },
    ]);
  });

  it('pairs within score groups when there are no rematches', () => {
    const pairs = pairSwissScoreGroups(
      [
        { userId: 'A', points: 6 },
        { userId: 'B', points: 6 },
        { userId: 'C', points: 3 },
        { userId: 'D', points: 3 },
      ],
      new Set(),
      new Set(),
    );

    expect(pairs).toEqual([
      { player1Id: 'A', player2Id: 'B', isBye: false },
      { player1Id: 'C', player2Id: 'D', isBye: false },
    ]);
  });

  it('avoids rematches by down pairing to lower score groups', () => {
    const pairs = pairSwissScoreGroups(
      [
        { userId: 'A', points: 6 },
        { userId: 'B', points: 6 },
        { userId: 'C', points: 3 },
        { userId: 'D', points: 3 },
      ],
      new Set(['A:B']),
      new Set(),
    );

    expect(pairs).toEqual([
      { player1Id: 'A', player2Id: 'C', isBye: false },
      { player1Id: 'B', player2Id: 'D', isBye: false },
    ]);
  });

  it('down pairs odd players in a score group', () => {
    const pairs = pairSwissScoreGroups(
      [
        { userId: 'A', points: 6 },
        { userId: 'B', points: 6 },
        { userId: 'C', points: 6 },
        { userId: 'D', points: 3 },
      ],
      new Set(),
      new Set(),
    );

    expect(pairs).toEqual([
      { player1Id: 'A', player2Id: 'B', isBye: false },
      { player1Id: 'C', player2Id: 'D', isBye: false },
    ]);
  });

  it('down pairs after rematch constraints in odd score groups', () => {
    const pairs = pairSwissScoreGroups(
      [
        { userId: 'A', points: 6 },
        { userId: 'B', points: 6 },
        { userId: 'C', points: 6 },
        { userId: 'D', points: 3 },
      ],
      new Set(['A:B']),
      new Set(),
    );

    expect(pairs).toEqual([
      { player1Id: 'A', player2Id: 'C', isBye: false },
      { player1Id: 'B', player2Id: 'D', isBye: false },
    ]);
  });

  it('allows rematch when no legal opponent exists', () => {
    const pairs = pairSwissScoreGroups(
      [
        { userId: 'A', points: 6 },
        { userId: 'B', points: 6 },
      ],
      new Set(['A:B']),
      new Set(),
    );

    expect(pairs).toEqual([{ player1Id: 'A', player2Id: 'B', isBye: false }]);
  });

  it('assigns bye to lowest ranked player without prior bye', () => {
    const pairs = pairSwissScoreGroups(
      [
        { userId: 'A', points: 12 },
        { userId: 'B', points: 9 },
        { userId: 'C', points: 6 },
        { userId: 'D', points: 3 },
        { userId: 'E', points: 0 },
      ],
      new Set(),
      new Set(['E']),
    );

    expect(pairs).toEqual([
      { player1Id: 'A', player2Id: 'B', isBye: false },
      { player1Id: 'C', player2Id: 'E', isBye: false },
      { player1Id: 'D', player2Id: null, isBye: true },
    ]);
  });

  it('assigns bye to lowest ranked when everyone already had a bye', () => {
    const pairs = pairSwissScoreGroups(
      [
        { userId: 'A', points: 6 },
        { userId: 'B', points: 3 },
        { userId: 'C', points: 0 },
      ],
      new Set(),
      new Set(['A', 'B', 'C']),
    );

    expect(pairs).toEqual([
      { player1Id: 'A', player2Id: 'B', isBye: false },
      { player1Id: 'C', player2Id: null, isBye: true },
    ]);
  });
});
