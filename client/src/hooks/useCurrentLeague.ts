import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type LeagueWithActiveSeason = {
  id: string;
  name: string;
  slug: string;
  seasons: Array<{
    id: string;
    name: string;
    number: number;
    isActive: boolean;
    poolVisibility: boolean;
    decklistVisibility: boolean;
    scheduleVisibility: boolean;
  }>;
};

type ApiListResponse<T> = { data: T[] };

export function useCurrentLeague() {
  const [league, setLeague] = useState<LeagueWithActiveSeason | null>(null);
  const [activeSeason, setActiveSeason] = useState<LeagueWithActiveSeason['seasons'][number] | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiRequest<ApiListResponse<LeagueWithActiveSeason>>('/api/leagues');
        const current = response.data[0] ?? null;
        setLeague(current);
        const active = current?.seasons[0] ?? null;
        setActiveSeason(active);
        setActiveSeasonId(active?.id ?? null);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const allSeasons = league?.seasons ?? [];

  return { league, activeSeason, activeSeasonId, allSeasons, isLoading };
}
