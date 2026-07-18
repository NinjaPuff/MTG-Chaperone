export type DraftPairing = {
  draftId: string;
  matchId?: string;
  player1Id: string;
  player2Id: string | null;
};

export type PairingValidation = {
  duplicatePlayers: Map<string, number>;
  samePlayerMatches: Set<string>;
  unpairedMembers: string[];
  isValid: boolean;
};

export function validateDraftPairings(draft: DraftPairing[], memberIds: string[]): PairingValidation {
  const playerCounts = new Map<string, number>();
  const samePlayerMatches = new Set<string>();
  const pairedMembers = new Set<string>();

  for (const pairing of draft) {
    if (pairing.player2Id !== null && pairing.player1Id === pairing.player2Id) {
      samePlayerMatches.add(pairing.draftId);
    }

    for (const playerId of [pairing.player1Id, pairing.player2Id]) {
      if (!playerId) {
        continue;
      }
      pairedMembers.add(playerId);
      playerCounts.set(playerId, (playerCounts.get(playerId) ?? 0) + 1);
    }
  }

  const duplicatePlayers = new Map<string, number>();
  for (const [playerId, count] of playerCounts) {
    if (count > 1) {
      duplicatePlayers.set(playerId, count);
    }
  }

  const unpairedMembers = memberIds.filter((memberId) => !pairedMembers.has(memberId));

  return {
    duplicatePlayers,
    samePlayerMatches,
    unpairedMembers,
    isValid: duplicatePlayers.size === 0 && samePlayerMatches.size === 0,
  };
}
