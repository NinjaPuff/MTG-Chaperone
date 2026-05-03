import { describe, expect, it } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
import { validateEventTransition } from '../../services/eventService.js';

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

describe('validateEventTransition', () => {
  it('allows setup->active and active->completed with all rounds completed', () => {
    expect(() => validateEventTransition('setup', 'active')).not.toThrow();
    expect(() =>
      validateEventTransition('active', 'completed', [
        { status: 'completed' },
        { status: 'completed' },
      ]),
    ).not.toThrow();
  });

  it('rejects invalid event transitions', () => {
    const invalidStartError = getAppError(() => validateEventTransition('completed', 'active'));
    expect(invalidStartError.code).toBe('INVALID_EVENT_STATE');

    const incompleteRoundsError = getAppError(() =>
      validateEventTransition('active', 'completed', [{ status: 'in_progress' }]),
    );
    expect(incompleteRoundsError.code).toBe('ROUND_INCOMPLETE');
  });
});
