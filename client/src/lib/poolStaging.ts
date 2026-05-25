type StagedPoolChangeLike = {
  action: string;
};

export function hasStagedRemovals(changes: StagedPoolChangeLike[]): boolean {
  return changes.some((change) => change.action === 'remove_one' || change.action === 'remove_all');
}

export function buildApplyStagedRemovalsConfirmMessage(totalChanges: number, removalCount: number): string {
  return `Apply ${totalChanges} staged change${totalChanges === 1 ? '' : 's'} including ${removalCount} removal${removalCount === 1 ? '' : 's'}? This updates the pool immediately.`;
}

export function countStagedRemovals(changes: StagedPoolChangeLike[]): number {
  return changes.filter((change) => change.action === 'remove_one' || change.action === 'remove_all').length;
}
