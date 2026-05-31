import { describe, expect, it } from 'vitest';
import {
  buildApplyStagedRemovalsConfirmMessage,
  countStagedAddCardTotal,
  countStagedRemovals,
  hasStagedRemovals,
  mergeStagedCardAdds,
  sumStagedCardQuantities,
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

describe('sumStagedCardQuantities', () => {
  it('sums card quantities including duplicates across rows', () => {
    expect(
      sumStagedCardQuantities([
        { quantity: 2 },
        { quantity: 1 },
        { quantity: 4 },
      ]),
    ).toBe(7);
  });

  it('returns zero for an empty list', () => {
    expect(sumStagedCardQuantities([])).toBe(0);
  });
});

describe('countStagedAddCardTotal', () => {
  it('includes staged card rows and context-menu staged adds', () => {
    expect(
      countStagedAddCardTotal(
        [{ quantity: 2 }, { quantity: 3 }],
        [{ action: 'add', quantity: 1 }, { action: 'remove_one', quantity: 1 }],
      ),
    ).toBe(6);
  });
});

describe('mergeStagedCardAdds', () => {
  const addition = {
    cachedCardId: 'card-1',
    name: 'Lightning Bolt',
    setCode: 'ECL',
    manaCost: '{R}',
    imageUri: 'https://example.com/bolt.jpg',
    quantity: 2,
  };

  it('adds a new staged card row', () => {
    const result = mergeStagedCardAdds([], [addition], 'Initial Pool');

    expect(result).toEqual([
      {
        cachedCardId: 'card-1',
        name: 'Lightning Bolt',
        setCode: 'ECL',
        manaCost: '{R}',
        imageUri: 'https://example.com/bolt.jpg',
        quantity: 2,
        phaseLabel: 'Initial Pool',
      },
    ]);
  });

  it('increments quantity for an existing staged card in the same phase', () => {
    const existing = [
      {
        cachedCardId: 'card-1',
        name: 'Lightning Bolt',
        setCode: 'ECL',
        manaCost: '{R}',
        imageUri: 'https://example.com/bolt.jpg',
        quantity: 1,
        phaseLabel: 'Initial Pool',
      },
    ];

    const result = mergeStagedCardAdds(existing, [{ ...addition, quantity: 2 }], 'Initial Pool');

    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(3);
  });

  it('keeps separate rows for the same card in different phases', () => {
    const existing = [
      {
        cachedCardId: 'card-1',
        name: 'Lightning Bolt',
        setCode: 'ECL',
        manaCost: '{R}',
        imageUri: 'https://example.com/bolt.jpg',
        quantity: 1,
        phaseLabel: 'Initial Pool',
      },
    ];

    const result = mergeStagedCardAdds(existing, [addition], 'After Round 1');

    expect(result).toHaveLength(2);
    expect(result.find((card) => card.phaseLabel === 'After Round 1')?.quantity).toBe(2);
    expect(result.find((card) => card.phaseLabel === 'Initial Pool')?.quantity).toBe(1);
  });

  it('merges multiple additions in one batch', () => {
    const result = mergeStagedCardAdds(
      [],
      [
        addition,
        {
          cachedCardId: 'card-2',
          name: 'Counterspell',
          setCode: 'ECL',
          manaCost: '{U}{U}',
          imageUri: null,
          quantity: 1,
        },
        { ...addition, quantity: 1 },
      ],
      'Initial Pool',
    );

    expect(result).toHaveLength(2);
    expect(result.find((card) => card.cachedCardId === 'card-1')?.quantity).toBe(3);
    expect(result.find((card) => card.cachedCardId === 'card-2')?.quantity).toBe(1);
  });
});
