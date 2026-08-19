import { describe, expect, it } from 'vitest';
import { suggestBasicLands } from '../../lib/suggestBasicLands';

describe('suggestBasicLands', () => {
  it('suggests mono-color basics for mono-color spells', () => {
    const suggestion = suggestBasicLands(
      [
        { quantity: 23, manaCost: '{1}{W}', typeLine: 'Creature - Human', colorIdentity: ['W'] },
      ],
      40,
    );

    expect(suggestion.Plains).toBe(17);
    expect(suggestion.Island).toBe(0);
    expect(suggestion.Swamp).toBe(0);
    expect(suggestion.Mountain).toBe(0);
    expect(suggestion.Forest).toBe(0);
    expect(suggestion.Wastes).toBe(0);
  });

  it('accounts for nonbasic lands when distributing basics', () => {
    const suggestion = suggestBasicLands(
      [
        { quantity: 10, manaCost: '{W}', typeLine: 'Creature - Human', colorIdentity: ['W'] },
        { quantity: 10, manaCost: '{U}', typeLine: 'Instant', colorIdentity: ['U'] },
        { quantity: 4, manaCost: null, typeLine: 'Land', colorIdentity: ['W', 'U'] },
      ],
      40,
    );

    expect(suggestion.Plains + suggestion.Island + suggestion.Swamp + suggestion.Mountain + suggestion.Forest + suggestion.Wastes).toBe(16);
    expect(suggestion.Plains).toBeGreaterThan(0);
    expect(suggestion.Island).toBeGreaterThan(0);
  });

  it('returns empty suggestion for fully colorless decks', () => {
    const suggestion = suggestBasicLands(
      [
        { quantity: 23, manaCost: '{3}', typeLine: 'Artifact Creature - Golem', colorIdentity: [] },
      ],
      40,
    );

    expect(suggestion.Wastes).toBe(0);
    expect(suggestion.Plains + suggestion.Island + suggestion.Swamp + suggestion.Mountain + suggestion.Forest).toBe(0);
  });

  it('returns zero wastes when nonbasic lands cover all color demand', () => {
    const suggestion = suggestBasicLands(
      [
        { quantity: 10, manaCost: '{W}', typeLine: 'Creature - Human', colorIdentity: ['W'] },
        { quantity: 10, manaCost: '{U}', typeLine: 'Instant', colorIdentity: ['U'] },
        { quantity: 20, manaCost: null, typeLine: 'Land', colorIdentity: ['W', 'U'] },
      ],
      40,
    );

    expect(suggestion.Wastes).toBe(0);
    expect(suggestion.Plains + suggestion.Island + suggestion.Swamp + suggestion.Mountain + suggestion.Forest).toBe(0);
  });
});
