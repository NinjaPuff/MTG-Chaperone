import { describe, expect, it, vi } from 'vitest';
import type { DeckSharePayload } from '@mtg-league/shared';
import { buildTokenShareUrl, isOverDiscordMessageLimit, mintDeckShareUrl } from '../../lib/shareLink';

const sample: DeckSharePayload = {
  v: 1,
  ownerDisplayName: 'Alice',
  deckName: 'Deck 1',
  eventName: 'Week 1',
  roundNumber: 1,
  status: 'draft',
  entries: [],
};

const mocks = vi.hoisted(() => ({
  authApiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  authApiRequest: mocks.authApiRequest,
}));

describe('buildTokenShareUrl', () => {
  it('puts the token in the path, not a query string or hash', () => {
    expect(buildTokenShareUrl('tok_ab12', 'https://league.example')).toBe(
      'https://league.example/share/decks/tok_ab12',
    );
    expect(buildTokenShareUrl('tok_ab12', 'https://league.example')).not.toContain('?');
    expect(buildTokenShareUrl('tok_ab12', 'https://league.example')).not.toContain('#');
  });
});

describe('mintDeckShareUrl', () => {
  it('POSTs the snapshot and returns the token URL', async () => {
    mocks.authApiRequest.mockResolvedValue({ data: { token: 'tok_ab12' } });
    await expect(mintDeckShareUrl('deck-1', sample, 'https://league.example')).resolves.toBe(
      'https://league.example/share/decks/tok_ab12',
    );
    expect(mocks.authApiRequest).toHaveBeenCalledWith('/api/decklists/deck-1/share', {
      method: 'POST',
      body: sample,
    });
  });
});

describe('isOverDiscordMessageLimit', () => {
  it('allows 2000 characters and warns at 2001', () => {
    expect(isOverDiscordMessageLimit('a'.repeat(2000))).toBe(false);
    expect(isOverDiscordMessageLimit('a'.repeat(2001))).toBe(true);
  });
});
