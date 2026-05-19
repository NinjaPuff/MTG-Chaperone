import { describe, expect, it } from 'vitest';
import { sumBucketQuantity } from '../../lib/curveBucketTotal';

describe('sumBucketQuantity', () => {
  it('sums card quantities in a bucket', () => {
    expect(
      sumBucketQuantity([
        { quantity: 4 },
        { quantity: 2 },
      ]),
    ).toBe(6);
  });

  it('returns quantity for a single card row', () => {
    expect(sumBucketQuantity([{ quantity: 4 }])).toBe(4);
  });
});
