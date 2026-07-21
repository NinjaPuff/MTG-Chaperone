import { describe, expect, it } from 'vitest';
import {
  buildSeasonPhaseOptions,
  computeDefaultPhase,
  computeOwnerAddPhaseOptions,
  formatPhaseLabel,
  normalizePhaseLabel,
} from '../../lib/poolPhase';

describe('formatPhaseLabel', () => {
  it('returns "Phase N" for a phase number', () => {
    expect(formatPhaseLabel(1)).toBe('Phase 1');
    expect(formatPhaseLabel(3)).toBe('Phase 3');
  });
});

describe('computeDefaultPhase', () => {
  it('returns "Phase 1" when no events are completed', () => {
    expect(computeDefaultPhase(0)).toBe('Phase 1');
  });

  it('returns "Phase 2" when one event is completed', () => {
    expect(computeDefaultPhase(1)).toBe('Phase 2');
  });

  it('returns "Phase 6" when five events are completed', () => {
    expect(computeDefaultPhase(5)).toBe('Phase 6');
  });
});

describe('buildSeasonPhaseOptions', () => {
  it('returns Phase 1 when the season has no events', () => {
    expect(buildSeasonPhaseOptions(0)).toEqual(['Phase 1']);
  });

  it('returns one phase per event plus the initial phase', () => {
    expect(buildSeasonPhaseOptions(3)).toEqual(['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']);
  });
});

describe('normalizePhaseLabel', () => {
  it('maps legacy Initial Pool to Phase 1', () => {
    expect(normalizePhaseLabel('Initial Pool')).toBe('Phase 1');
  });

  it('maps legacy After Round N to Phase N+1', () => {
    expect(normalizePhaseLabel('After Round 1')).toBe('Phase 2');
    expect(normalizePhaseLabel('After Round 5')).toBe('Phase 6');
  });

  it('leaves Phase N labels unchanged', () => {
    expect(normalizePhaseLabel('Phase 2')).toBe('Phase 2');
  });
});

describe('computeOwnerAddPhaseOptions', () => {
  it('includes current and next phase when a later window exists', () => {
    expect(computeOwnerAddPhaseOptions(1, 3)).toEqual(['Phase 2', 'Phase 3']);
  });

  it('includes Phase 1 and Phase 2 before any event completes', () => {
    expect(computeOwnerAddPhaseOptions(0, 2)).toEqual(['Phase 1', 'Phase 2']);
  });

  it('returns only the current phase when there is no next window', () => {
    expect(computeOwnerAddPhaseOptions(2, 2)).toEqual(['Phase 3']);
  });
});
