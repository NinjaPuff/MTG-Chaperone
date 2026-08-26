import { encodeDeckSharePayload, type DeckSharePayload } from '@mtg-league/shared';
import { authApiRequest } from '@/lib/api';

export const DISCORD_MESSAGE_LIMIT = 2000;

export function buildDeckShareUrl(payload: DeckSharePayload, origin = window.location.origin) {
  return `${origin}/share/decks#${encodeDeckSharePayload(payload)}`;
}

export function buildTokenShareUrl(token: string, origin = window.location.origin) {
  return `${origin}/share/decks/${encodeURIComponent(token)}`;
}

export async function mintDeckShareUrl(
  decklistId: string,
  payload: DeckSharePayload,
  origin = window.location.origin,
) {
  const response = await authApiRequest<{ data: { token: string } }>(`/api/decklists/${decklistId}/share`, {
    method: 'POST',
    body: payload,
  });
  return buildTokenShareUrl(response.data.token, origin);
}

export function isOverDiscordMessageLimit(url: string) {
  return url.length > DISCORD_MESSAGE_LIMIT;
}
