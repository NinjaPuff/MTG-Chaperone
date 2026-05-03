import { describe, expect, it } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
import { validateMatchStateTransition } from '../../services/matchService.js';

function getAppError(fn: () => void) {
  try {
    fn();
    throw new Error('Expected AppError to be thrown');
  } catch (error) {
    if (!(error instanceof AppError)) {
      throw error;
    }
    return error;
  }
}

describe('validateMatchStateTransition', () => {
  it('allows valid report and confirm transitions', () => {
    expect(() => validateMatchStateTransition('pending', 'report', null, 'u1')).not.toThrow();
    expect(() => validateMatchStateTransition('reported', 'confirm', 'u1', 'u2')).not.toThrow();
  });

  it('blocks self-confirm and invalid status', () => {
    const selfConfirmError = getAppError(() => validateMatchStateTransition('reported', 'confirm', 'u1', 'u1'));
    expect(selfConfirmError.code).toBe('VALIDATION_ERROR');

    const invalidStateError = getAppError(() => validateMatchStateTransition('pending', 'confirm', 'u1', 'u2'));
    expect(invalidStateError.code).toBe('INVALID_MATCH_STATE');
  });
});
