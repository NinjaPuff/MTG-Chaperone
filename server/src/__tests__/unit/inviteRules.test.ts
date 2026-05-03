import { describe, expect, it } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
import { validateInviteState } from '../../services/inviteService.js';

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

describe('validateInviteState', () => {
  it('accepts active and non-expired invites with remaining uses', () => {
    expect(() =>
      validateInviteState({
        status: 'active',
        expiresAt: null,
        maxUses: 5,
        useCount: 1,
      }),
    ).not.toThrow();
  });

  it('rejects revoked, expired, and exhausted invites', () => {
    const revokedError = getAppError(() =>
      validateInviteState({
        status: 'revoked',
        expiresAt: null,
        maxUses: null,
        useCount: 0,
      }),
    );
    expect(revokedError.code).toBe('INVALID_INVITE');

    const expiredError = getAppError(() =>
      validateInviteState(
        {
          status: 'active',
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
          maxUses: null,
          useCount: 0,
        },
        new Date('2020-01-02T00:00:00.000Z'),
      ),
    );
    expect(expiredError.code).toBe('INVITE_EXPIRED');

    const exhaustedError = getAppError(() =>
      validateInviteState({
        status: 'active',
        expiresAt: null,
        maxUses: 1,
        useCount: 1,
      }),
    );
    expect(exhaustedError.code).toBe('INVITE_EXHAUSTED');
  });
});
