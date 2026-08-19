import { beforeEach, describe, expect, it } from 'vitest';
import {
  isExtraDeckSlot,
  otherPrepSize,
  readStoredPrepSize,
  resolveBuilderSizeTarget,
  writeStoredPrepSize,
} from '../../lib/prepDeckSize';

describe('prepDeckSize helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns opposite prep size for 40-card events', () => {
    expect(otherPrepSize(40)).toBe(60);
  });

  it('returns opposite prep size for 60-card events', () => {
    expect(otherPrepSize(60)).toBe(40);
  });

  it('should_default_extra_deck_target_to_60_when_event_min_is_45', () => {
    expect(otherPrepSize(45)).toBe(60);
    expect(
      resolveBuilderSizeTarget({
        orderIndex: 1,
        requiredDeckCount: 1,
        eventMinDeckSize: 45,
        stored: null,
      }),
    ).toBe(60);
  });

  it('identifies extra deck slots', () => {
    expect(isExtraDeckSlot(1, 1)).toBe(true);
    expect(isExtraDeckSlot(0, 1)).toBe(false);
  });

  it('uses event minimum for required deck slots', () => {
    expect(resolveBuilderSizeTarget({ orderIndex: 0, requiredDeckCount: 1, eventMinDeckSize: 40, stored: 60 })).toBe(40);
  });

  it('uses stored prep target when available for extra slots', () => {
    expect(resolveBuilderSizeTarget({ orderIndex: 1, requiredDeckCount: 1, eventMinDeckSize: 40, stored: 40 })).toBe(40);
  });

  it('falls back to opposite prep target when no stored value exists', () => {
    expect(resolveBuilderSizeTarget({ orderIndex: 1, requiredDeckCount: 1, eventMinDeckSize: 40, stored: null })).toBe(60);
  });

  it('round-trips stored prep sizes', () => {
    writeStoredPrepSize('deck-2', 60);
    expect(readStoredPrepSize('deck-2')).toBe(60);
  });

  it('returns null for invalid stored prep sizes', () => {
    window.localStorage.setItem('deckbuilder-prep-size:deck-2', '41');
    expect(readStoredPrepSize('deck-2')).toBeNull();
  });
});
