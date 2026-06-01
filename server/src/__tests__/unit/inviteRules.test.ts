import { describe, expect, it } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
import {
  shouldConsumeInviteUse,
  validateInviteActive,
  validateInviteCapacity,
  validateInviteState,
} from '../../services/inviteService.js';

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

describe('validateInviteActive', () => {
  it('accepts active invites that are not expired', () => {
    expect(() =>
      validateInviteActive({
        status: 'active',
        expiresAt: null,
      }),
    ).not.toThrow();
  });

  it('rejects revoked and expired invites', () => {
    const revokedError = getAppError(() =>
      validateInviteActive({
        status: 'revoked',
        expiresAt: null,
      }),
    );
    expect(revokedError.code).toBe('INVALID_INVITE');

    const expiredError = getAppError(() =>
      validateInviteActive(
        {
          status: 'active',
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        },
        new Date('2020-01-02T00:00:00.000Z'),
      ),
    );
    expect(expiredError.code).toBe('INVITE_EXPIRED');
  });
});

describe('validateInviteCapacity', () => {
  it('accepts unlimited and non-exhausted invites', () => {
    expect(() =>
      validateInviteCapacity({
        maxUses: null,
        useCount: 99,
      }),
    ).not.toThrow();

    expect(() =>
      validateInviteCapacity({
        maxUses: 5,
        useCount: 4,
      }),
    ).not.toThrow();
  });

  it('rejects exhausted invites', () => {
    const exhaustedError = getAppError(() =>
      validateInviteCapacity({
        maxUses: 1,
        useCount: 1,
      }),
    );
    expect(exhaustedError.code).toBe('INVITE_EXHAUSTED');
  });
});

describe('shouldConsumeInviteUse', () => {
  it('returns true only when the user is not already a member', () => {
    expect(shouldConsumeInviteUse(false)).toBe(true);
    expect(shouldConsumeInviteUse(true)).toBe(false);
  });
});
