import { describe, expect, it } from 'vitest';
import {
  assertOwnerPhaseAllowed,
  buildSeasonPhaseOptions,
  computeDefaultPhase,
  computeOwnerAddPhaseOptions,
  countCompletedEvents,
  isSeasonLocked,
  expandPhaseLabelMatches,
  normalizePhaseLabel,
} from '../../lib/poolRules.js';
import { AppError } from '../../middleware/errorHandler.js';

describe('isSeasonLocked', () => {
  it('returns false for an empty event list', () => {
    expect(isSeasonLocked([])).toBe(false);
  });

  it('returns false when the only event is setup', () => {
    expect(isSeasonLocked([{ status: 'setup' }])).toBe(false);
  });

  it('returns false when the only event is active', () => {
    expect(isSeasonLocked([{ status: 'active' }])).toBe(false);
  });

  it('returns true when the only event is completed', () => {
    expect(isSeasonLocked([{ status: 'completed' }])).toBe(true);
  });

  it('returns true when all events are completed', () => {
    expect(isSeasonLocked([{ status: 'completed' }, { status: 'completed' }])).toBe(true);
  });

  it('returns false when one event is still active', () => {
    expect(isSeasonLocked([{ status: 'completed' }, { status: 'active' }])).toBe(false);
  });

  it('returns false when one event is still in setup', () => {
    expect(isSeasonLocked([{ status: 'completed' }, { status: 'setup' }])).toBe(false);
  });
});

describe('computeDefaultPhase', () => {
  it('returns Phase 1 when no events are completed', () => {
    expect(computeDefaultPhase(0)).toBe('Phase 1');
  });

  it('returns Phase N+1 for N completed events', () => {
    expect(computeDefaultPhase(2)).toBe('Phase 3');
  });
});

describe('buildSeasonPhaseOptions', () => {
  it('returns Phase 1 when the season has no events', () => {
    expect(buildSeasonPhaseOptions(0)).toEqual(['Phase 1']);
  });

  it('returns one phase per event plus the initial phase', () => {
    expect(buildSeasonPhaseOptions(2)).toEqual(['Phase 1', 'Phase 2', 'Phase 3']);
  });
});

describe('normalizePhaseLabel', () => {
  it('maps legacy labels to Phase N', () => {
    expect(normalizePhaseLabel('Initial Pool')).toBe('Phase 1');
    expect(normalizePhaseLabel('After Round 2')).toBe('Phase 3');
  });
});

describe('expandPhaseLabelMatches', () => {
  it('includes legacy and current labels for the same phase', () => {
    expect(expandPhaseLabelMatches('Phase 2')).toEqual(
      expect.arrayContaining(['Phase 2', 'After Round 1']),
    );
    expect(expandPhaseLabelMatches('Initial Pool')).toEqual(
      expect.arrayContaining(['Phase 1', 'Initial Pool']),
    );
  });
});

describe('countCompletedEvents', () => {
  it('counts only completed events', () => {
    expect(
      countCompletedEvents([{ status: 'completed' }, { status: 'active' }, { status: 'setup' }]),
    ).toBe(1);
  });
});

describe('computeOwnerAddPhaseOptions', () => {
  it('includes the next window when one exists', () => {
    expect(computeOwnerAddPhaseOptions(1, 3)).toEqual(['Phase 2', 'Phase 3']);
  });

  it('locks to the current window when there is no next event', () => {
    expect(computeOwnerAddPhaseOptions(2, 2)).toEqual(['Phase 3']);
  });
});

describe('assertOwnerPhaseAllowed', () => {
  const events = [{ status: 'completed' }, { status: 'active' }];

  it('allows the current and next phase for owners', () => {
    expect(() => assertOwnerPhaseAllowed('Phase 2', events)).not.toThrow();
    expect(() => assertOwnerPhaseAllowed('Phase 3', events)).not.toThrow();
  });

  it('accepts legacy phase labels', () => {
    expect(() => assertOwnerPhaseAllowed('After Round 1', events)).not.toThrow();
  });

  it('rejects phases outside the current and next window', () => {
    expect(() => assertOwnerPhaseAllowed('Phase 1', events)).toThrow(AppError);

    try {
      assertOwnerPhaseAllowed('Phase 1', events);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('PHASE_NOT_ALLOWED');
    }
  });
});
