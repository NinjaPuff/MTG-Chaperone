import { describe, expect, it } from 'vitest';
import { buildRoundRobinPairs, pairPlayers } from '../../services/eventService.js';

describe('pairPlayers', () => {
  it('creates pairs and bye for odd players', () => {
    const pairs = pairPlayers(['u1', 'u2', 'u3']);

    expect(pairs).toEqual([
      { player1Id: 'u1', player2Id: 'u2', isBye: false },
      { player1Id: 'u3', player2Id: null, isBye: true },
    ]);
  });
});

describe('buildRoundRobinPairs', () => {
  it('creates n-1 rounds with unique opponents for even players', () => {
    const rounds = buildRoundRobinPairs(['u1', 'u2', 'u3', 'u4']);

    expect(rounds).toHaveLength(3);
    expect(rounds.every((round) => round.length === 2)).toBe(true);

    const seenPairs = new Set<string>();
    for (const round of rounds) {
      for (const pair of round) {
        expect(pair.isBye).toBe(false);
        const key = [pair.player1Id, pair.player2Id].sort().join(':');
        seenPairs.add(key);
      }
    }

    // 4 players should yield 6 unique pairings in a full round robin.
    expect(seenPairs.size).toBe(6);
  });
});
