import { describe, expect, it } from 'vitest';
import { adjustMenuPhaseOptions, defaultAdjustPhaseLabel } from '../../lib/poolAdjustMenu';

describe('adjustMenuPhaseOptions', () => {
  it('should_return_add_phase_options_intersecting_matching_when_owner', () => {
    expect(
      adjustMenuPhaseOptions({
        isAdmin: false,
        addPhaseOptions: ['Phase 2', 'Phase 3'],
        availablePhaseOptions: ['Phase 1', 'Phase 2', 'Phase 3'],
        matchingPhases: ['Phase 1', 'Phase 2'],
      }),
    ).toEqual(['Phase 2']);
  });

  it('should_return_matching_phases_when_admin', () => {
    expect(
      adjustMenuPhaseOptions({
        isAdmin: true,
        addPhaseOptions: ['Phase 2', 'Phase 3'],
        availablePhaseOptions: ['Phase 1', 'Phase 2', 'Phase 3'],
        matchingPhases: ['Phase 1'],
      }),
    ).toEqual(['Phase 1']);
  });
});

describe('defaultAdjustPhaseLabel', () => {
  it('should_default_to_selected_add_phase_when_that_phase_has_copies', () => {
    expect(
      defaultAdjustPhaseLabel({
        selectedAddPhase: 'Phase 2',
        phaseQuantities: { 'Phase 2': 1, 'Phase 3': 0 },
        allowedPhases: ['Phase 2', 'Phase 3'],
        cardPhaseLabel: 'Phase 2',
      }),
    ).toBe('Phase 2');
  });

  it('should_fall_back_to_first_allowed_phase_with_copies_when_selected_empty', () => {
    expect(
      defaultAdjustPhaseLabel({
        selectedAddPhase: 'Phase 3',
        phaseQuantities: { 'Phase 2': 1, 'Phase 3': 0 },
        allowedPhases: ['Phase 2', 'Phase 3'],
        cardPhaseLabel: 'Phase 2',
      }),
    ).toBe('Phase 2');
  });
});
