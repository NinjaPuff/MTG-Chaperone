import { describe, expect, it } from 'vitest';
import {
  buildPairKey,
  isFinalRound,
  pairCompanionSwiss,
  selectByePlayer,
  shuffle,
} from '../../services/companionSwissPairing.js';

const zeroRng = () => 0;

type Pair = { player1Id: string; player2Id: string | null; isBye: boolean };
type EventRecord = {
  userId: string;
  points: number;
  omwPercent: number;
  gwPercent: number;
  ogwPercent: number;
};

function canonical(pairs: Pair[]) {
  return {
    games: pairs
      .filter((p) => !p.isBye)
      .map((p) => [p.player1Id, p.player2Id!].sort().join(':'))
      .sort(),
    byes: pairs.filter((p) => p.isBye).map((p) => p.player1Id).sort(),
  };
}

function rec(userId: string, points: number, omw = 0.33, gw = 0.33, ogw = 0.33): EventRecord {
  return { userId, points, omwPercent: omw, gwPercent: gw, ogwPercent: ogw };
}

function pairArgs(overrides: Partial<Parameters<typeof pairCompanionSwiss>[0]> & { playerIds: string[] }) {
  return {
    eventRecords: overrides.playerIds.map((id) => rec(id, 0)),
    playedPairs: new Set<string>(),
    priorByeIds: new Set<string>(),
    roundNumber: 2,
    totalRounds: 4,
    random: zeroRng,
    ...overrides,
  };
}

describe('isFinalRound', () => {
  it('is false for round 1 even when it is the only round', () => {
    expect(isFinalRound(1, 1)).toBe(false);
  });

  it('is false for early and mid rounds', () => {
    expect(isFinalRound(1, 3)).toBe(false);
    expect(isFinalRound(2, 3)).toBe(false);
  });

  it('is true when roundNumber equals totalRounds and is greater than 1', () => {
    expect(isFinalRound(3, 3)).toBe(true);
  });

  it('is false when totalRounds is null', () => {
    expect(isFinalRound(2, null)).toBe(false);
    expect(isFinalRound(5, null)).toBe(false);
  });
});

describe('shuffle', () => {
  it('returns the zeroRng permutation without mutating the input', () => {
    const input = ['A', 'B', 'C', 'D'];
    const shuffled = shuffle(input, zeroRng);

    expect(shuffled).toEqual(['B', 'C', 'D', 'A']);
    expect(input).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('selectByePlayer', () => {
  it('picks the last eligible player after a round-1 shuffle', () => {
    expect(
      selectByePlayer({
        playerIds: ['A', 'B', 'C'],
        eventRecords: [rec('A', 0), rec('B', 0), rec('C', 0)],
        priorByeIds: new Set(),
        roundNumber: 1,
        totalRounds: 3,
        random: zeroRng,
      }),
    ).toBe('A');
  });

  it('picks the lowest-points player in a mid-round', () => {
    expect(
      selectByePlayer({
        playerIds: ['A', 'B', 'C'],
        eventRecords: [rec('A', 6), rec('B', 3), rec('C', 0)],
        priorByeIds: new Set(),
        roundNumber: 2,
        totalRounds: 4,
        random: zeroRng,
      }),
    ).toBe('C');
  });

  it('breaks mid-round zero-point ties by shuffling the tied subset', () => {
    expect(
      selectByePlayer({
        playerIds: ['A', 'B', 'D', 'E'],
        eventRecords: [rec('A', 6), rec('B', 3), rec('D', 0), rec('E', 0)],
        priorByeIds: new Set(),
        roundNumber: 2,
        totalRounds: 4,
        random: zeroRng,
      }),
    ).toBe('D');
  });

  it('skips a prior bye and assigns the next-lowest eligible player', () => {
    expect(
      selectByePlayer({
        playerIds: ['A', 'B', 'C', 'D', 'E'],
        eventRecords: [rec('A', 12), rec('B', 9), rec('C', 6), rec('D', 3), rec('E', 0)],
        priorByeIds: new Set(['E']),
        roundNumber: 2,
        totalRounds: 4,
        random: zeroRng,
      }),
    ).toBe('D');
  });

  it('still assigns a second bye when everyone already had one', () => {
    expect(
      selectByePlayer({
        playerIds: ['A', 'B', 'C'],
        eventRecords: [rec('A', 6), rec('B', 3), rec('C', 0)],
        priorByeIds: new Set(['A', 'B', 'C']),
        roundNumber: 2,
        totalRounds: 4,
        random: zeroRng,
      }),
    ).toBe('C');
  });

  it('uses standings for the final-round bye and ignores RNG', () => {
    expect(
      selectByePlayer({
        playerIds: ['A', 'B', 'C', 'D', 'E'],
        eventRecords: [rec('A', 12), rec('B', 9), rec('C', 6), rec('D', 3), rec('E', 0)],
        priorByeIds: new Set(),
        roundNumber: 3,
        totalRounds: 3,
        random: () => 0.99,
      }),
    ).toBe('E');
  });
});

describe('pairCompanionSwiss', () => {
  it('returns empty when there are no players', () => {
    expect(pairCompanionSwiss(pairArgs({ playerIds: [] }))).toEqual([]);
  });

  it('gives a singleton a bye', () => {
    expect(canonical(pairCompanionSwiss(pairArgs({ playerIds: ['A'] })))).toEqual({
      games: [],
      byes: ['A'],
    });
  });

  it('pairs a round-1 even field from the shuffled order, not input 1v2', () => {
    const args = pairArgs({
      playerIds: ['A', 'B', 'C', 'D'],
      roundNumber: 1,
      totalRounds: 3,
    });
    const first = pairCompanionSwiss(args);
    const second = pairCompanionSwiss(args);

    expect(canonical(first)).toEqual({ games: ['A:D', 'B:C'], byes: [] });
    expect(canonical(first)).not.toEqual({ games: ['A:B', 'C:D'], byes: [] });
    expect(canonical(second)).toEqual(canonical(first));
  });

  it('gives the leftover shuffled player a bye in round 1', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C'],
            roundNumber: 1,
            totalRounds: 3,
          }),
        ),
      ),
    ).toEqual({ games: ['B:C'], byes: ['A'] });
  });

  it('ignores rematch history in round 1', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            playedPairs: new Set(['B:C']),
            roundNumber: 1,
            totalRounds: 3,
          }),
        ),
      ),
    ).toEqual({ games: ['A:D', 'B:C'], byes: [] });
  });

  it('pairs a mid-round equal-point group by shuffle, not by OMW%', () => {
    const pairs = pairCompanionSwiss(
      pairArgs({
        playerIds: ['A', 'B', 'C', 'D'],
        eventRecords: [rec('A', 6, 0.9), rec('B', 6), rec('C', 6), rec('D', 6)],
        roundNumber: 2,
        totalRounds: 4,
      }),
    );

    expect(canonical(pairs)).toEqual({ games: ['A:D', 'B:C'], byes: [] });
    expect(canonical(pairs)).not.toEqual({ games: ['A:B', 'C:D'], byes: [] });
  });

  it('downfloats one player from an odd 6-point group', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 6), rec('B', 6), rec('C', 6), rec('D', 3)],
            roundNumber: 2,
            totalRounds: 4,
          }),
        ),
      ),
    ).toEqual({ games: ['A:C', 'B:D'], byes: [] });
  });

  it('uses rematch constraints to choose which 6-pointer downfloats', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 6), rec('B', 6), rec('C', 6), rec('D', 3)],
            playedPairs: new Set(['B:C']),
            roundNumber: 2,
            totalRounds: 4,
          }),
        ),
      ),
    ).toEqual({ games: ['A:C', 'B:D'], byes: [] });
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 6), rec('B', 6), rec('C', 6), rec('D', 3)],
            playedPairs: new Set(['B:C']),
            roundNumber: 2,
            totalRounds: 4,
          }),
        ),
      ),
    ).not.toEqual({ games: ['A:B', 'C:D'], byes: [] });
  });

  it('avoids a 9-point rematch when both can pair down', () => {
    const games = canonical(
      pairCompanionSwiss(
        pairArgs({
          playerIds: ['A', 'B', 'C', 'D'],
          eventRecords: [rec('A', 9), rec('B', 9), rec('C', 6), rec('D', 6)],
          playedPairs: new Set(['A:B']),
          roundNumber: 2,
          totalRounds: 4,
        }),
      ),
    ).games;

    expect(games).not.toContain('A:B');
    expect([
      ['A:C', 'B:D'].sort().join(','),
      ['A:D', 'B:C'].sort().join(','),
    ]).toContain(games.join(','));
  });

  it('allows a rematch only when no legal opponent remains', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B'],
            eventRecords: [rec('A', 6), rec('B', 6)],
            playedPairs: new Set(['A:B']),
            roundNumber: 2,
            totalRounds: 4,
          }),
        ),
      ),
    ).toEqual({ games: ['A:B'], byes: [] });
  });

  it('keeps draw-point players in the same score group', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 1), rec('B', 1), rec('C', 0), rec('D', 0)],
            roundNumber: 2,
            totalRounds: 4,
          }),
        ),
      ),
    ).toEqual({ games: ['A:B', 'C:D'], byes: [] });
  });

  it('treats a null totalRounds as a mid-round', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 6, 0.9), rec('B', 6), rec('C', 6), rec('D', 6)],
            roundNumber: 5,
            totalRounds: null,
          }),
        ),
      ),
    ).toEqual({ games: ['A:D', 'B:C'], byes: [] });
  });

  it('pairs the final round by standings, not mid-round shuffle', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 9, 0.8), rec('B', 6, 0.7), rec('C', 3, 0.5), rec('D', 0)],
            roundNumber: 3,
            totalRounds: 3,
          }),
        ),
      ),
    ).toEqual({ games: ['A:B', 'C:D'], byes: [] });
  });

  it('skips a rematch in the final round and pairs 1 vs next legal', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 9, 0.8), rec('B', 6, 0.7), rec('C', 3, 0.5), rec('D', 0)],
            playedPairs: new Set(['A:B']),
            roundNumber: 3,
            totalRounds: 3,
          }),
        ),
      ),
    ).toEqual({ games: ['A:C', 'B:D'], byes: [] });
  });

  it('does not use seeded top-vs-bottom in the final round', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 9, 0.8), rec('B', 6, 0.7), rec('C', 3, 0.5), rec('D', 0)],
            roundNumber: 3,
            totalRounds: 3,
          }),
        ),
      ),
    ).not.toEqual({ games: ['A:D', 'B:C'], byes: [] });
  });

  it('assigns the mid-round bye to the lowest eligible player without a prior bye', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D', 'E'],
            eventRecords: [rec('A', 12), rec('B', 9), rec('C', 6), rec('D', 3), rec('E', 0)],
            priorByeIds: new Set(['E']),
            roundNumber: 2,
            totalRounds: 4,
          }),
        ),
      ).byes,
    ).toEqual(['D']);
  });

  it('assigns the final-round bye to the lowest standings player', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D', 'E'],
            eventRecords: [rec('A', 12), rec('B', 9), rec('C', 6), rec('D', 3), rec('E', 0)],
            roundNumber: 3,
            totalRounds: 3,
            random: () => 0.99,
          }),
        ),
      ).byes,
    ).toEqual(['E']);
  });

  it('downfloats exactly one player from an odd high group into the next group', () => {
    const pairs = pairCompanionSwiss(
      pairArgs({
        playerIds: ['A', 'B', 'C', 'D', 'E'],
        eventRecords: [rec('A', 6), rec('B', 6), rec('C', 6), rec('D', 3), rec('E', 3)],
        roundNumber: 2,
        totalRounds: 4,
      }),
    );

    const games = canonical(pairs).games;

    expect(canonical(pairs).byes).toEqual(['D']);
    expect(games.filter((game) => game.includes('E'))).toHaveLength(1);
    expect(games.filter((game) => !game.includes('E'))).toHaveLength(1);
  });

  it('does not downfloat a player who already played everyone in the next group when another player can go down', () => {
    const pairs = pairCompanionSwiss(
      pairArgs({
        playerIds: ['A', 'B', 'C', 'D'],
        eventRecords: [rec('A', 6), rec('B', 6), rec('C', 6), rec('D', 3)],
        playedPairs: new Set(['A:D']),
        roundNumber: 2,
        totalRounds: 4,
      }),
    );

    expect(canonical(pairs).games).not.toContain('A:D');
    expect(canonical(pairs).games.some((game) => game.includes('D'))).toBe(true);
  });

  it('pairs chained singleton score groups without leaving anyone unpaired', () => {
    const pairs = pairCompanionSwiss(
      pairArgs({
        playerIds: ['A', 'B', 'C', 'D'],
        eventRecords: [rec('A', 9), rec('B', 6), rec('C', 3), rec('D', 0)],
        roundNumber: 2,
        totalRounds: 4,
      }),
    );

    expectLegalField(['A', 'B', 'C', 'D'], pairs);
    expect(canonical(pairs).byes).toEqual([]);
  });

  it('skips a rematch when a singleton 9-pointer already played the 6-pointer', () => {
    expect(
      canonical(
        pairCompanionSwiss(
          pairArgs({
            playerIds: ['A', 'B', 'C', 'D'],
            eventRecords: [rec('A', 9), rec('B', 6), rec('C', 3), rec('D', 0)],
            playedPairs: new Set(['A:B']),
            roundNumber: 2,
            totalRounds: 4,
          }),
        ),
      ).games,
    ).not.toContain('A:B');
  });

  it('never rematches when a rematch-free pairing exists in an 8-player equal-point group', () => {
    const playedPairs = new Set(['A:B', 'C:D', 'E:F', 'G:H', 'A:C', 'B:D']);
    const pairs = pairCompanionSwiss(
      pairArgs({
        playerIds: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        eventRecords: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((id) => rec(id, 6)),
        playedPairs,
        roundNumber: 2,
        totalRounds: 5,
      }),
    );

    expectLegalField(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], pairs);
    expect(rematchGames(pairs, playedPairs)).toEqual([]);
  });

  it('allows rematches only after the score-group graph is exhausted', () => {
    const playedPairs = new Set(['A:B', 'A:C', 'B:C']);
    const pairs = pairCompanionSwiss(
      pairArgs({
        playerIds: ['A', 'B', 'C', 'D'],
        eventRecords: [rec('A', 6), rec('B', 6), rec('C', 6), rec('D', 6)],
        playedPairs,
        roundNumber: 2,
        totalRounds: 4,
      }),
    );

    expectLegalField(['A', 'B', 'C', 'D'], pairs);
    expect(rematchGames(pairs, playedPairs).length).toBeGreaterThan(0);
  });
});

describe('pairCompanionSwiss field invariants', () => {
  it('covers every player exactly once for odd and even fields across several seeds', () => {
    const fields = [
      ['A', 'B', 'C', 'D', 'E'],
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'],
    ];
    const seeds = [0, 0.17, 0.33, 0.5, 0.71, 0.99];

    for (const playerIds of fields) {
      for (const seed of seeds) {
        const pairs = pairCompanionSwiss(
          pairArgs({
            playerIds,
            eventRecords: playerIds.map((id, index) => rec(id, (index % 4) * 3)),
            playedPairs: new Set(
              playerIds.slice(0, 4).map((id, index) => buildPairKey(id, playerIds[(index + 1) % playerIds.length])),
            ),
            priorByeIds: new Set(playerIds.length % 2 === 1 ? [playerIds[0]] : []),
            roundNumber: 2,
            totalRounds: 5,
            random: () => seed,
          }),
        );
        expectLegalField(playerIds, pairs);
      }
    }
  });
});

function expectLegalField(playerIds: string[], pairs: Pair[]) {
  const seen: string[] = [];
  let byes = 0;
  for (const pair of pairs) {
    seen.push(pair.player1Id);
    if (pair.isBye) {
      expect(pair.player2Id).toBeNull();
      byes += 1;
    } else {
      expect(pair.player2Id).toBeTruthy();
      seen.push(pair.player2Id!);
    }
  }
  expect(new Set(seen).size).toBe(playerIds.length);
  expect(seen.sort()).toEqual([...playerIds].sort());
  expect(byes).toBe(playerIds.length % 2);
}

function rematchGames(pairs: Pair[], playedPairs: Set<string>) {
  return pairs
    .filter((pair) => !pair.isBye && pair.player2Id && playedPairs.has(buildPairKey(pair.player1Id, pair.player2Id)))
    .map((pair) => buildPairKey(pair.player1Id, pair.player2Id!));
}
