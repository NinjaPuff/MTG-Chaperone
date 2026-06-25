import { apiRequest } from '@/lib/api';
import type { BracketSlotView } from '@/components/bracket/types';

type ApiResponse<T> = { data: T };
type ApiListResponse<T> = { data: T[] };

export async function fetchBracketState(eventId: string) {
  const response = await apiRequest<ApiResponse<BracketSlotView[]>>(`/api/events/${eventId}/bracket`);
  return response.data;
}

export async function reloadBracketEventViews<TRound>(eventId: string, isBracketEvent: boolean) {
  const roundsResponse = await apiRequest<ApiListResponse<TRound>>(`/api/events/${eventId}/rounds`);
  const bracketSlots = isBracketEvent ? await fetchBracketState(eventId) : [];
  return { rounds: roundsResponse.data, bracketSlots };
}
