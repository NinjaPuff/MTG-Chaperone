import { describe, expect, it } from 'vitest';
import { createCustom10PlayerBracket } from '@mtg-league/shared';
import { resolveBracketParticipantUserId, resolveBracketSlotParticipants } from '../../services/bracketService.js';

function buildSlotMap(overrides: Partial<Record<string, Parameters<typeof resolveBracketParticipantUserId>[1] extends Map<string, infer T> ? T : never>>) {
  const slots = createCustom10PlayerBracket().slots.map((slot) => ({
    slotKey: slot.slotKey,
    bracketSide: slot.bracketSide,
    bracketRound: slot.bracketRound,
    player1Id: null,
    player2Id: null,
    matchId: null,
    winnerId: null,
    loserId: null,
    match: null,
  }));

  const map = new Map(slots.map((slot) => [slot.slotKey, slot]));
  for (const [slotKey, override] of Object.entries(overrides)) {
    const existing = map.get(slotKey);
    if (existing) {
      map.set(slotKey, { ...existing, ...override });
    }
  }
  return map;
}

describe('resolveBracketParticipantUserId', () => {
  it('derives downstream winners and losers from reported feeder matches', () => {
    const slotsByKey = buildSlotMap({
      W1: {
        player1Id: 'u3',
        player2Id: 'u6',
        match: {
          status: 'reported',
          player1Id: 'u3',
          player2Id: 'u6',
          gameResults: [
            { winnerId: 'u3', isDraw: false },
            { winnerId: 'u3', isDraw: false },
          ],
        },
      },
      L1: {
        player1Id: 'u9',
        player2Id: 'u10',
        match: {
          status: 'reported',
          player1Id: 'u9',
          player2Id: 'u10',
          gameResults: [
            { winnerId: 'u9', isDraw: false },
            { winnerId: 'u9', isDraw: false },
          ],
        },
      },
    });
    const seedByNum = new Map(Array.from({ length: 10 }, (_, index) => [index + 1, `u${index + 1}`]));
    const w3 = createCustom10PlayerBracket().slots.find((slot) => slot.slotKey === 'W3')!;
    const l3 = createCustom10PlayerBracket().slots.find((slot) => slot.slotKey === 'L3')!;

    expect(resolveBracketSlotParticipants(w3, slotsByKey, seedByNum)).toEqual({
      player1Id: 'u1',
      player2Id: 'u3',
    });
    expect(resolveBracketSlotParticipants(l3, slotsByKey, seedByNum)).toEqual({
      player1Id: 'u9',
      player2Id: 'u6',
    });
  });
});
