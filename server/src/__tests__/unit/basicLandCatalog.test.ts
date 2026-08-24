import { describe, expect, it } from 'vitest';
import { BASIC_LAND_CATALOG_NAMES } from '../../services/decklistService.js';

describe('BASIC_LAND_CATALOG_NAMES', () => {
  it('lists the five classic basics and excludes Wastes', () => {
    expect(BASIC_LAND_CATALOG_NAMES).toEqual(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);
    expect(BASIC_LAND_CATALOG_NAMES).not.toContain('Wastes');
  });
});
