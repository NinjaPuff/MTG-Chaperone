export type EventScopedDecklistCandidate = {
  id: string;
  orderIndex: number;
  status: 'draft' | 'submitted' | 'locked';
  roundNumber: number;
  createdAt: Date;
  updatedAt: Date;
  hasEntries: boolean;
};

export type EventScopedKeeperGroup = {
  keeperId: string;
  loserIds: string[];
};

function statusRank(status: EventScopedDecklistCandidate['status']): number {
  if (status === 'locked') {
    return 3;
  }
  if (status === 'submitted') {
    return 2;
  }
  return 1;
}

function requiredRank(candidate: EventScopedDecklistCandidate): number[] {
  return [
    -statusRank(candidate.status),
    candidate.status === 'draft' && !candidate.hasEntries ? 1 : 0,
    candidate.roundNumber,
    candidate.createdAt.getTime(),
  ];
}

function extraRank(candidate: EventScopedDecklistCandidate): number[] {
  return [
    candidate.hasEntries ? 0 : 1,
    -candidate.roundNumber,
    -candidate.updatedAt.getTime(),
  ];
}

function compareRanks(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

export function selectEventScopedDecklistKeeper(args: {
  requiredDeckCount: number;
  candidates: EventScopedDecklistCandidate[];
}): EventScopedKeeperGroup[] {
  const deckCount = Math.max(1, args.requiredDeckCount);
  const groups = new Map<number, EventScopedDecklistCandidate[]>();
  for (const candidate of args.candidates) {
    const list = groups.get(candidate.orderIndex) ?? [];
    list.push(candidate);
    groups.set(candidate.orderIndex, list);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([orderIndex, members]) => {
      const rank = orderIndex < deckCount ? requiredRank : extraRank;
      const sorted = [...members].sort((left, right) => compareRanks(rank(left), rank(right)));
      const keeper = sorted[0];
      return {
        keeperId: keeper.id,
        loserIds: sorted.slice(1).map((member) => member.id),
      };
    });
}
