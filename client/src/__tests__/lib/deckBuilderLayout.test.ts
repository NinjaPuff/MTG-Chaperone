import { describe, expect, it } from 'vitest';
import { isDeckBuilderPath } from '../../lib/deckBuilderLayout';

describe('isDeckBuilderPath', () => {
  it('returns true for event build routes', () => {
    expect(isDeckBuilderPath('/events/e1/build')).toBe(true);
    expect(isDeckBuilderPath('/events/e1/rounds/r1/build')).toBe(true);
  });

  it('returns false for other routes', () => {
    expect(isDeckBuilderPath('/events/e1')).toBe(false);
    expect(isDeckBuilderPath('/pools/p1')).toBe(false);
  });
});
