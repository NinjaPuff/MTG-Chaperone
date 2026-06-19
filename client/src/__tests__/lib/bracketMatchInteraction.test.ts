import { describe, expect, it } from 'vitest';
import { getBracketMatchInteraction, isBracketMatchClickable } from '@/lib/bracketMatchInteraction';

const match = {
  status: 'reported',
  reportedById: 'u1',
  player1: { id: 'u1' },
  player2: { id: 'u2' },
};

const round = { status: 'in_progress' };

describe('getBracketMatchInteraction', () => {
  it('allows reporting only pending matches in an active round', () => {
    expect(
      getBracketMatchInteraction(
        { ...match, status: 'pending', reportedById: null },
        round,
        'u1',
        false,
      ),
    ).toBe('report');
  });

  it('does not allow the reporter to resubmit a reported match', () => {
    expect(getBracketMatchInteraction(match, round, 'u1', false)).toBeNull();
    expect(isBracketMatchClickable(match, round, 'u1', false)).toBe(false);
  });

  it('does not allow the opponent to open the report form from a reported match', () => {
    expect(getBracketMatchInteraction(match, round, 'u2', false)).toBeNull();
  });

  it('allows admins to resolve disputed matches', () => {
    expect(
      getBracketMatchInteraction(
        { ...match, status: 'disputed' },
        round,
        undefined,
        true,
      ),
    ).toBe('resolve');
  });

  it('blocks reporting when the round is not in progress', () => {
    expect(
      getBracketMatchInteraction(
        { ...match, status: 'pending', reportedById: null },
        { status: 'completed' },
        'u1',
        false,
      ),
    ).toBeNull();
  });
});
