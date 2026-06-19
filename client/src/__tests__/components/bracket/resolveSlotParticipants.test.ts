import { describe, expect, it } from 'vitest';
import { createCustom10PlayerBracket } from '@mtg-league/shared';
import {
  computeBracketMatchOutcome,
  resolveSlotParticipants,
} from '@/components/bracket/resolveSlotParticipants';
import type { BracketSlotView } from '@/components/bracket/types';

function buildSlots(overrides: Partial<Record<string, Partial<BracketSlotView>>> = {}): BracketSlotView[] {
  return createCustom10PlayerBracket().slots.map((slot) => ({
    id: `slot-${slot.slotKey}`,
    slotKey: slot.slotKey,
    bracketSide: slot.bracketSide,
    bracketRound: slot.bracketRound,
    col: slot.col,
    row: slot.row,
    source1: slot.source1,
    source2: slot.source2,
    player1: null,
    player2: null,
    winnerId: null,
    match: null,
    ...overrides[slot.slotKey],
  }));
}

describe('resolveSlotParticipants', () => {
  it('shows seeded players before their first match starts', () => {
    const slots = buildSlots({
      W1: {
        player1: { id: 'u3', displayName: 'Seed Three', publicName: null, slug: 'seed-three', avatarUrl: null },
        player2: { id: 'u6', displayName: 'Seed Six', publicName: null, slug: 'seed-six', avatarUrl: null },
      },
      W3: {
        player1: { id: 'u1', displayName: 'Scott', publicName: 'Scott', slug: 'scott', avatarUrl: null },
      },
    });

    const w3 = slots.find((slot) => slot.slotKey === 'W3')!;
    const [player1, player2] = resolveSlotParticipants(w3, slots);

    expect(player1.label).toBe('Scott');
    expect(player2.label).toBe('Winner · Match 2');
    expect(player2.isPlaceholder).toBe(true);
  });

  it('shows provisional winners and losers from reported feeder matches', () => {
    const slots = buildSlots({
      W1: {
        player1: { id: 'u3', displayName: 'Seed Three', publicName: null, slug: 'seed-three', avatarUrl: null },
        player2: { id: 'u6', displayName: 'Seed Six', publicName: null, slug: 'seed-six', avatarUrl: null },
        match: {
          id: 'm1',
          status: 'reported',
          gameResults: [
            { winnerId: 'u3', isDraw: false },
            { winnerId: 'u3', isDraw: false },
          ],
        },
      },
    });

    const w3 = slots.find((slot) => slot.slotKey === 'W3')!;
    const l3 = slots.find((slot) => slot.slotKey === 'L3')!;
    const [, w3Player2] = resolveSlotParticipants(w3, slots);
    const [, l3Player2] = resolveSlotParticipants(l3, slots);

    expect(w3Player2.label).toBe('Seed Three');
    expect(w3Player2.isPlaceholder).toBe(false);
    expect(l3Player2.label).toBe('Seed Six');
    expect(l3Player2.isPlaceholder).toBe(false);
  });

  it('shows assigned downstream players after bracket advancement', () => {
    const slots = buildSlots({
      W3: {
        player1: { id: 'u1', displayName: 'Scott', publicName: 'Scott', slug: 'scott', avatarUrl: null },
        player2: { id: 'u3', displayName: 'Seed Three', publicName: null, slug: 'seed-three', avatarUrl: null },
      },
    });

    const w3 = slots.find((slot) => slot.slotKey === 'W3')!;
    const [, player2] = resolveSlotParticipants(w3, slots);

    expect(player2.label).toBe('Seed Three');
    expect(player2.isPlaceholder).toBe(false);
  });

  it('shows the upstream winner once a feeder match completes', () => {
    const slots = buildSlots({
      W1: {
        player1: { id: 'u3', displayName: 'Seed Three', publicName: null, slug: 'seed-three', avatarUrl: null },
        player2: { id: 'u6', displayName: 'Seed Six', publicName: null, slug: 'seed-six', avatarUrl: null },
        winnerId: 'u3',
      },
      W3: {
        player1: { id: 'u1', displayName: 'Scott', publicName: 'Scott', slug: 'scott', avatarUrl: null },
      },
    });

    const w3 = slots.find((slot) => slot.slotKey === 'W3')!;
    const [, player2] = resolveSlotParticipants(w3, slots);

    expect(player2.label).toBe('Seed Three');
    expect(player2.isPlaceholder).toBe(false);
  });
});

describe('computeBracketMatchOutcome', () => {
  it('derives winner and loser from reported game results', () => {
    const outcome = computeBracketMatchOutcome({
      winnerId: null,
      player1: { id: 'u3', displayName: 'Seed Three', publicName: null, slug: 'seed-three', avatarUrl: null },
      player2: { id: 'u6', displayName: 'Seed Six', publicName: null, slug: 'seed-six', avatarUrl: null },
      match: {
        id: 'm1',
        status: 'reported',
        gameResults: [
          { winnerId: 'u3', isDraw: false },
          { winnerId: 'u3', isDraw: false },
        ],
      },
    });

    expect(outcome?.winner.id).toBe('u3');
    expect(outcome?.loser.id).toBe('u6');
  });
});
