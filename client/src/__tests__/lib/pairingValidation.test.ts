import { describe, expect, it } from 'vitest';
import { validateDraftPairings } from '@/lib/pairingValidation';

describe('validateDraftPairings', () => {
  const memberIds = ['u1', 'u2', 'u3', 'u4', 'u5'];

  it('detects duplicate player across matches', () => {
    const result = validateDraftPairings([
      { draftId: 'd1', matchId: 'm1', player1Id: 'u1', player2Id: 'u2' },
      { draftId: 'd2', matchId: 'm2', player1Id: 'u1', player2Id: 'u3' },
    ], memberIds);

    expect(result.duplicatePlayers.get('u1')).toBe(2);
    expect(result.isValid).toBe(false);
  });

  it('detects same-player match', () => {
    const result = validateDraftPairings([
      { draftId: 'd1', matchId: 'm1', player1Id: 'u1', player2Id: 'u1' },
      { draftId: 'd2', matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
    ], memberIds);

    expect(result.samePlayerMatches.has('d1')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('lists unpaired members without blocking save', () => {
    const result = validateDraftPairings([
      { draftId: 'd1', matchId: 'm1', player1Id: 'u1', player2Id: 'u2' },
      { draftId: 'd2', matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
    ], memberIds);

    expect(result.unpairedMembers).toEqual(['u5']);
    expect(result.isValid).toBe(true);
  });

  it('returns isValid true for a clean round', () => {
    const result = validateDraftPairings([
      { draftId: 'd1', matchId: 'm1', player1Id: 'u1', player2Id: 'u2' },
      { draftId: 'd2', matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      { draftId: 'd3', matchId: 'm3', player1Id: 'u5', player2Id: null },
    ], memberIds);

    expect(result.duplicatePlayers.size).toBe(0);
    expect(result.samePlayerMatches.size).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it('ignores BYE in duplicate check', () => {
    const result = validateDraftPairings([
      { draftId: 'd1', matchId: 'm1', player1Id: 'u1', player2Id: null },
      { draftId: 'd2', matchId: 'm2', player1Id: 'u2', player2Id: null },
    ], memberIds);

    expect(result.duplicatePlayers.size).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it('validates new rows without matchId', () => {
    const result = validateDraftPairings([
      { draftId: 'd1', player1Id: 'u1', player2Id: 'u2' },
      { draftId: 'd2', player1Id: 'u3', player2Id: 'u4' },
    ], memberIds);

    expect(result.isValid).toBe(true);
    expect(result.unpairedMembers).toEqual(['u5']);
  });

  it('returns isValid true for an empty draft', () => {
    const result = validateDraftPairings([], memberIds);

    expect(result.isValid).toBe(true);
    expect(result.unpairedMembers).toEqual(memberIds);
  });
});
