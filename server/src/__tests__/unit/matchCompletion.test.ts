import { describe, expect, it } from 'vitest';
import { playerHasFinishedEventMatches } from '../../lib/matchCompletion.js';

describe('playerHasFinishedEventMatches', () => {
  it('is false when the player has no matches', () => {
    expect(playerHasFinishedEventMatches([])).toBe(false);
  });

  it('is false when one match is pending', () => {
    expect(playerHasFinishedEventMatches([{ status: 'pending' }])).toBe(false);
  });

  it('is false when confirmed matches are mixed with a pending match', () => {
    expect(
      playerHasFinishedEventMatches([{ status: 'confirmed' }, { status: 'pending' }]),
    ).toBe(false);
  });

  it('is true when every match is confirmed or resolved', () => {
    expect(
      playerHasFinishedEventMatches([{ status: 'confirmed' }, { status: 'resolved' }]),
    ).toBe(true);
  });

  it('is false when a match is reported', () => {
    expect(playerHasFinishedEventMatches([{ status: 'reported' }])).toBe(false);
  });

  it('is false when a match is disputed', () => {
    expect(playerHasFinishedEventMatches([{ status: 'disputed' }])).toBe(false);
  });

  it('is true when the only match is a terminal bye', () => {
    expect(playerHasFinishedEventMatches([{ status: 'confirmed' }])).toBe(true);
  });
});
