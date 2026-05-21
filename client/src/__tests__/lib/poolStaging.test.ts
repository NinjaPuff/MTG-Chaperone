import { describe, expect, it } from 'vitest';
import {
  buildApplyStagedRemovalsConfirmMessage,
  countStagedRemovals,
  hasStagedRemovals,
} from '../../lib/poolStaging';

describe('poolStaging', () => {
  it('detects staged removals', () => {
    expect(hasStagedRemovals([{ action: 'add' }])).toBe(false);
    expect(hasStagedRemovals([{ action: 'remove_one' }])).toBe(true);
    expect(hasStagedRemovals([{ action: 'remove_all' }])).toBe(true);
  });

  it('counts staged removals', () => {
    expect(
      countStagedRemovals([{ action: 'add' }, { action: 'remove_one' }, { action: 'remove_all' }]),
    ).toBe(2);
  });

  it('builds apply confirm message', () => {
    expect(buildApplyStagedRemovalsConfirmMessage(3, 2)).toBe(
      'Apply 3 staged changes including 2 removals? This updates the pool immediately.',
    );
    expect(buildApplyStagedRemovalsConfirmMessage(1, 1)).toBe(
      'Apply 1 staged change including 1 removal? This updates the pool immediately.',
    );
  });
});
