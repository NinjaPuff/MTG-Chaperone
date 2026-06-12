import { describe, expect, it, vi } from 'vitest';
import { confirmDisputeMatch, DISPUTE_MATCH_CONFIRM } from '@/lib/matchDisputeConfirm';

describe('confirmDisputeMatch', () => {
  it('returns confirm result from dialog', async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    await expect(confirmDisputeMatch(confirm)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith(DISPUTE_MATCH_CONFIRM);
  });
});
