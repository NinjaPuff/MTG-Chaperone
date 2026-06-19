import { primaryName } from '@/lib/userDisplay';
import { buildBracketMatchLabels, slotDisplayLabel } from './layoutBracket';
import type { BracketSlotView, BracketSource, BracketUser } from './types';

export type ResolvedParticipant = {
  label: string;
  userId?: string;
  avatarUrl?: string | null;
  isPlaceholder: boolean;
};

const DECIDED_MATCH_STATUSES = new Set(['reported', 'confirmed', 'resolved']);

function participantFromUser(user: BracketUser, isPlaceholder = false): ResolvedParticipant {
  return {
    label: primaryName(user),
    userId: user.id,
    avatarUrl: user.avatarUrl,
    isPlaceholder,
  };
}

function buildSeedUserMap(slots: BracketSlotView[]) {
  const seedUsers = new Map<number, BracketUser>();

  for (const slot of slots) {
    if (slot.source1.type === 'seed' && slot.player1) {
      seedUsers.set(slot.source1.seedNum, slot.player1);
    }
    if (slot.source2.type === 'seed' && slot.player2) {
      seedUsers.set(slot.source2.seedNum, slot.player2);
    }
  }

  return seedUsers;
}

export function computeBracketMatchOutcome(
  slot: Pick<BracketSlotView, 'winnerId' | 'player1' | 'player2' | 'match'>,
): { winner: BracketUser; loser: BracketUser } | null {
  if (!slot.player1 || !slot.player2) {
    return null;
  }

  if (slot.winnerId) {
    const winner = slot.player1.id === slot.winnerId ? slot.player1 : slot.player2.id === slot.winnerId ? slot.player2 : null;
    const loser = slot.player1.id === slot.winnerId ? slot.player2 : slot.player2.id === slot.winnerId ? slot.player1 : null;
    if (winner && loser) {
      return { winner, loser };
    }
  }

  if (!slot.match || !DECIDED_MATCH_STATUSES.has(slot.match.status)) {
    return null;
  }

  let player1Wins = 0;
  let player2Wins = 0;
  for (const game of slot.match.gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === slot.player1.id) {
      player1Wins += 1;
    } else if (game.winnerId === slot.player2.id) {
      player2Wins += 1;
    }
  }

  if (player1Wins === player2Wins) {
    return null;
  }

  return player1Wins > player2Wins
    ? { winner: slot.player1, loser: slot.player2 }
    : { winner: slot.player2, loser: slot.player1 };
}

function loserPlayer(slot: BracketSlotView): BracketUser | null {
  return computeBracketMatchOutcome(slot)?.loser ?? null;
}

function winnerPlayer(slot: BracketSlotView): BracketUser | null {
  return computeBracketMatchOutcome(slot)?.winner ?? null;
}

function placeholderLabel(
  source: BracketSource,
  slotsByKey: Map<string, BracketSlotView>,
  matchLabels?: Map<string, string>,
) {
  if (source.type === 'seed') {
    return `Seed ${source.seedNum}`;
  }

  const upstream = slotsByKey.get(source.slotKey);
  const upstreamLabel = upstream ? slotDisplayLabel(upstream, matchLabels) : source.slotKey;
  return source.takes === 'winner' ? `Winner · ${upstreamLabel}` : `Loser · ${upstreamLabel}`;
}

function resolveSourceParticipant(
  source: BracketSource,
  assigned: BracketUser | null,
  seedUsers: Map<number, BracketUser>,
  slotsByKey: Map<string, BracketSlotView>,
  matchLabels?: Map<string, string>,
): ResolvedParticipant {
  if (assigned) {
    return participantFromUser(assigned);
  }

  if (source.type === 'seed') {
    const seedUser = seedUsers.get(source.seedNum);
    if (seedUser) {
      return participantFromUser(seedUser);
    }
    return { label: `Seed ${source.seedNum}`, isPlaceholder: true };
  }

  const upstream = slotsByKey.get(source.slotKey);
  if (!upstream) {
    return { label: placeholderLabel(source, slotsByKey, matchLabels), isPlaceholder: true };
  }

  const resolved = source.takes === 'winner' ? winnerPlayer(upstream) : loserPlayer(upstream);
  if (resolved) {
    return participantFromUser(resolved);
  }

  return { label: placeholderLabel(source, slotsByKey, matchLabels), isPlaceholder: true };
}

export function resolveSlotParticipants(
  slot: BracketSlotView,
  slots: BracketSlotView[],
  matchLabels?: Map<string, string>,
): [ResolvedParticipant, ResolvedParticipant] {
  const slotsByKey = new Map(slots.map((entry) => [entry.slotKey, entry]));
  const seedUsers = buildSeedUserMap(slots);
  const labels = matchLabels ?? buildBracketMatchLabels(slots);

  return [
    resolveSourceParticipant(slot.source1, slot.player1, seedUsers, slotsByKey, labels),
    resolveSourceParticipant(slot.source2, slot.player2, seedUsers, slotsByKey, labels),
  ];
}
