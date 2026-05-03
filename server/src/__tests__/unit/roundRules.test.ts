import { describe, expect, it } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
import { validateRoundTransition } from '../../services/roundService.js';

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

describe('validateRoundTransition', () => {
  it('allows valid start, complete, and delete transitions', () => {
    expect(() => validateRoundTransition('not_started', 'start')).not.toThrow();
    expect(() =>
      validateRoundTransition('in_progress', 'complete', [
        { status: 'confirmed' },
        { status: 'resolved' },
      ]),
    ).not.toThrow();
    expect(() => validateRoundTransition('completed', 'delete')).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    const invalidStartError = getAppError(() => validateRoundTransition('completed', 'start'));
    expect(invalidStartError.code).toBe('INVALID_ROUND_STATE');

    const incompleteMatchError = getAppError(() =>
      validateRoundTransition('in_progress', 'complete', [{ status: 'reported' }]),
    );
    expect(incompleteMatchError.code).toBe('MATCH_INCOMPLETE');

    const invalidDeleteError = getAppError(() => validateRoundTransition('not_started', 'delete'));
    expect(invalidDeleteError.code).toBe('INVALID_ROUND_STATE');
  });
});
