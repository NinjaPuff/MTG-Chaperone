import { describe, expect, it } from 'vitest';
import {
  selectEventScopedDecklistKeeper,
  type EventScopedDecklistCandidate,
} from '../../lib/eventScopedDecklistKeeper.js';

function candidate(
  overrides: Partial<EventScopedDecklistCandidate> & Pick<EventScopedDecklistCandidate, 'id' | 'orderIndex'>,
): EventScopedDecklistCandidate {
  return {
    status: 'draft',
    roundNumber: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    hasEntries: false,
    ...overrides,
  };
}

describe('selectEventScopedDecklistKeeper', () => {
  it('keeps locked required over submitted and empty round-2 draft', () => {
    const result = selectEventScopedDecklistKeeper({
      candidates: [
        candidate({
          id: 'locked-r1',
          orderIndex: 0,
          status: 'locked',
          roundNumber: 1,
        }),
        candidate({
          id: 'submitted-r1',
          orderIndex: 0,
          status: 'submitted',
          roundNumber: 1,
        }),
        candidate({
          id: 'empty-r2',
          orderIndex: 0,
          status: 'draft',
          roundNumber: 2,
          hasEntries: false,
        }),
      ],
    });

    expect(result).toEqual([{ keeperId: 'locked-r1', loserIds: ['submitted-r1', 'empty-r2'] }]);
  });

  it('keeps submitted required over empty round-2 draft', () => {
    const result = selectEventScopedDecklistKeeper({
      candidates: [
        candidate({
          id: 'alice-req-0',
          orderIndex: 0,
          status: 'submitted',
          roundNumber: 1,
          hasEntries: true,
        }),
        candidate({
          id: 'empty-r2',
          orderIndex: 0,
          status: 'draft',
          roundNumber: 2,
          hasEntries: false,
        }),
      ],
    });

    expect(result).toEqual([{ keeperId: 'alice-req-0', loserIds: ['empty-r2'] }]);
  });

  it('keeps draft-with-entries over empty required clone', () => {
    const result = selectEventScopedDecklistKeeper({
      candidates: [
        candidate({
          id: 'empty-clone',
          orderIndex: 0,
          status: 'draft',
          roundNumber: 2,
          hasEntries: false,
        }),
        candidate({
          id: 'draft-with-cards',
          orderIndex: 0,
          status: 'draft',
          roundNumber: 1,
          hasEntries: true,
        }),
      ],
    });

    expect(result).toEqual([{ keeperId: 'draft-with-cards', loserIds: ['empty-clone'] }]);
  });

  it('required tie uses lowest roundNumber then oldest createdAt', () => {
    const result = selectEventScopedDecklistKeeper({
      candidates: [
        candidate({
          id: 'newer-same-round',
          orderIndex: 0,
          status: 'submitted',
          roundNumber: 1,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
        candidate({
          id: 'older-same-round',
          orderIndex: 0,
          status: 'submitted',
          roundNumber: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
        candidate({
          id: 'later-round',
          orderIndex: 0,
          status: 'submitted',
          roundNumber: 2,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ],
    });

    expect(result).toEqual([
      { keeperId: 'older-same-round', loserIds: ['newer-same-round', 'later-round'] },
    ]);
  });

  it('extra tie uses lowest roundNumber then oldest createdAt', () => {
    const result = selectEventScopedDecklistKeeper({
      candidates: [
        candidate({
          id: 'extra-r1-newer',
          orderIndex: 1,
          status: 'draft',
          roundNumber: 1,
          hasEntries: true,
          updatedAt: new Date('2026-02-01T00:00:00.000Z'),
        }),
        candidate({
          id: 'extra-r2-older-update',
          orderIndex: 1,
          status: 'draft',
          roundNumber: 2,
          hasEntries: true,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
        candidate({
          id: 'extra-r2-newest-update',
          orderIndex: 1,
          status: 'draft',
          roundNumber: 2,
          hasEntries: true,
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        }),
      ],
    });

    expect(result).toEqual([
      {
        keeperId: 'extra-r1-newer',
        loserIds: ['extra-r2-older-update', 'extra-r2-newest-update'],
      },
    ]);
  });

  it('groups collisions by orderIndex only', () => {
    const result = selectEventScopedDecklistKeeper({
      candidates: [
        candidate({
          id: 'required-locked',
          orderIndex: 0,
          status: 'locked',
          roundNumber: 1,
        }),
        candidate({
          id: 'extra-draft',
          orderIndex: 1,
          status: 'draft',
          roundNumber: 1,
          hasEntries: true,
        }),
        candidate({
          id: 'extra-empty',
          orderIndex: 1,
          status: 'draft',
          roundNumber: 2,
          hasEntries: false,
        }),
      ],
    });

    const byKeeper = new Map(result.map((group) => [group.keeperId, group.loserIds]));
    expect(byKeeper.get('required-locked')).toEqual([]);
    expect(byKeeper.get('extra-draft')).toEqual(['extra-empty']);
    expect(byKeeper.has('extra-empty')).toBe(false);
    expect(result.some((group) => group.keeperId === 'required-locked' && group.loserIds.includes('extra-draft'))).toBe(
      false,
    );
  });
});
