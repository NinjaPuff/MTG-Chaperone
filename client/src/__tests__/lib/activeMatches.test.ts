import { describe, expect, it } from 'vitest';
import { formatActiveRoundLabel, getUserActiveMatches } from '@/lib/activeMatches';
import { makeMatch, makeRound } from '../helpers/matchFixtures';

describe('getUserActiveMatches', () => {
  it('returns empty when userId is undefined', () => {
    const rounds = [makeRound({ matches: [makeMatch()] })];
    expect(getUserActiveMatches(rounds, undefined)).toEqual([]);
  });

  it('includes pending match in in_progress round for participant', () => {
    const match = makeMatch({ id: 'm-pending', status: 'pending' });
    const round = makeRound({ roundNumber: 1, matches: [match] });
    const result = getUserActiveMatches([round], 'u1');
    expect(result).toEqual([{ match, round }]);
  });

  it('includes reported match for non-reporter only', () => {
    const match = makeMatch({ id: 'm-reported', status: 'reported', reportedById: 'u1' });
    const round = makeRound({ matches: [match] });
    expect(getUserActiveMatches([round], 'u2')).toEqual([{ match, round }]);
    expect(getUserActiveMatches([round], 'u1')).toEqual([]);
  });

  it('includes disputed match for both participants', () => {
    const match = makeMatch({ id: 'm-disputed', status: 'disputed', reportedById: 'u1' });
    const round = makeRound({ matches: [match] });
    expect(getUserActiveMatches([round], 'u1')).toEqual([{ match, round }]);
    expect(getUserActiveMatches([round], 'u2')).toEqual([{ match, round }]);
  });

  it('excludes confirmed and resolved matches', () => {
    const confirmed = makeMatch({ id: 'm-confirmed', status: 'confirmed' });
    const resolved = makeMatch({ id: 'm-resolved', status: 'resolved' });
    const round = makeRound({ matches: [confirmed, resolved] });
    expect(getUserActiveMatches([round], 'u1')).toEqual([]);
  });

  it('excludes matches in not_started or completed rounds', () => {
    const match = makeMatch({ id: 'm1' });
    const notStarted = makeRound({ id: 'r-ns', status: 'not_started', matches: [match] });
    const completed = makeRound({ id: 'r-c', status: 'completed', matches: [makeMatch({ id: 'm2' })] });
    expect(getUserActiveMatches([notStarted, completed], 'u1')).toEqual([]);
  });

  it('excludes matches where user is not a participant', () => {
    const match = makeMatch({
      player1: { id: 'u3', displayName: 'Carol', publicName: null, slug: 'carol' },
      player2: { id: 'u4', displayName: 'Dave', publicName: null, slug: 'dave' },
    });
    const round = makeRound({ matches: [match] });
    expect(getUserActiveMatches([round], 'u1')).toEqual([]);
  });

  it('returns matches from multiple in_progress rounds sorted by roundNumber', () => {
    const matchR2 = makeMatch({ id: 'm-r2' });
    const matchR5 = makeMatch({ id: 'm-r5' });
    const round2 = makeRound({ id: 'r2', roundNumber: 2, matches: [matchR2] });
    const round5 = makeRound({ id: 'r5', roundNumber: 5, matches: [matchR5] });
    const result = getUserActiveMatches([round5, round2], 'u1');
    expect(result.map((entry) => ({ matchId: entry.match.id, roundNumber: entry.round.roundNumber }))).toEqual([
      { matchId: 'm-r2', roundNumber: 2 },
      { matchId: 'm-r5', roundNumber: 5 },
    ]);
  });

  it('excludes confirmed bye match for participant', () => {
    const match = makeMatch({
      id: 'm-bye',
      status: 'confirmed',
      isBye: true,
      player2: null,
    });
    const round = makeRound({ matches: [match] });
    expect(getUserActiveMatches([round], 'u1')).toEqual([]);
  });
});

describe('formatActiveRoundLabel', () => {
  it('labels bracket rounds by bracket side', () => {
    expect(formatActiveRoundLabel(1, 'custom_10_player')).toBe('Top 1');
    expect(formatActiveRoundLabel(22, 'double_elimination')).toBe('Bottom 2');
    expect(formatActiveRoundLabel(41, 'single_elimination')).toBe('Finals 1');
  });

  it('keeps swiss-style round labels for non-bracket formats', () => {
    expect(formatActiveRoundLabel(3, 'swiss')).toBe('Round 3');
  });
});
