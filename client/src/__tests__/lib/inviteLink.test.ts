import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildInviteJoinUrl, copyTextToClipboard } from '../../lib/inviteLink';

describe('buildInviteJoinUrl', () => {
  it('builds a join URL from token and origin', () => {
    expect(buildInviteJoinUrl('abc123', 'https://league.example')).toBe(
      'https://league.example/join?token=abc123',
    );
  });
});

describe('copyTextToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('writes text using the clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copyTextToClipboard('https://league.example/join?token=abc123');

    expect(writeText).toHaveBeenCalledWith('https://league.example/join?token=abc123');
  });
});
