import { describe, expect, it } from 'vitest';
import {
  computeMinimumChangesShortfall,
  computeRestrictedCopies,
  filterNewOrWorsenedAllocationViolations,
  validateCombinedAllocation,
} from '../../services/decklistService.js';

describe('decklistService pure logic', () => {
  it('computes per-copy restrictions from the immediately previous round', () => {
    const restricted = computeRestrictedCopies({
      constraintType: 'no_repeat_previous',
      poolQuantityByCardId: new Map([
        ['card-a', 4],
        ['card-b', 2],
      ]),
      priorRoundEntries: [
        { roundNumber: 1, cachedCardId: 'card-a', quantity: 2, typeLine: 'Creature - Human' },
        { roundNumber: 2, cachedCardId: 'card-a', quantity: 1, typeLine: 'Creature - Human' },
        { roundNumber: 2, cachedCardId: 'card-b', quantity: 1, typeLine: 'Instant' },
      ],
    });

    expect(restricted.get('card-a')?.restrictedQty).toBe(1);
    expect(restricted.get('card-b')?.restrictedQty).toBe(1);
  });

  it('caps cumulative restricted copies at pool quantity and ignores basic lands', () => {
    const restricted = computeRestrictedCopies({
      constraintType: 'cumulative_ban',
      poolQuantityByCardId: new Map([
        ['card-a', 2],
        ['card-b', 1],
      ]),
      priorRoundEntries: [
        { roundNumber: 1, cachedCardId: 'card-a', quantity: 2, typeLine: 'Creature - Human' },
        { roundNumber: 2, cachedCardId: 'card-a', quantity: 2, typeLine: 'Creature - Human' },
        { roundNumber: 2, cachedCardId: 'card-b', quantity: 3, typeLine: 'Basic Land - Forest' },
      ],
    });

    expect(restricted.get('card-a')?.restrictedQty).toBe(2);
    expect(restricted.has('card-b')).toBe(false);
  });

  it('computes minimum-change shortfall against previous deck card presence', () => {
    const shortfall = computeMinimumChangesShortfall({
      minChanges: 2,
      previousCardIds: new Set(['card-a', 'card-b']),
      currentEntries: [
        { cachedCardId: 'card-a', quantity: 3, typeLine: 'Creature - Human' },
        { cachedCardId: 'card-c', quantity: 1, typeLine: 'Sorcery' },
      ],
    });

    expect(shortfall).toBe(1);
  });

  it('detects over-allocation after restrictions are applied', () => {
    const violations = validateCombinedAllocation({
      poolQuantityByCardId: new Map([['card-a', 3]]),
      restrictedQuantityByCardId: new Map([['card-a', 1]]),
      combinedDeckAllocationByCardId: new Map([['card-a', 3]]),
      basicLandCardIds: new Set<string>(),
    });

    expect(violations).toEqual([
      {
        cachedCardId: 'card-a',
        allowed: 2,
        allocated: 3,
      },
    ]);
  });

  it('flags only newly introduced or worsened allocation violations', () => {
    const worsened = filterNewOrWorsenedAllocationViolations({
      previousViolations: [
        { cachedCardId: 'card-a', allowed: 0, allocated: 2 },
        { cachedCardId: 'card-b', allowed: 1, allocated: 2 },
      ],
      nextViolations: [
        { cachedCardId: 'card-a', allowed: 0, allocated: 1 },
        { cachedCardId: 'card-b', allowed: 1, allocated: 3 },
        { cachedCardId: 'card-c', allowed: 0, allocated: 1 },
      ],
    });

    expect(worsened).toEqual([
      { cachedCardId: 'card-b', allowed: 1, allocated: 3 },
      { cachedCardId: 'card-c', allowed: 0, allocated: 1 },
    ]);
  });
});
