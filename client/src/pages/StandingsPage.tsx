import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { primaryName } from '@/lib/userDisplay';

type StandingRow = {
  id: string;
  points: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  omwPercent: number;
  gwPercent: number;
  ogwPercent: number;
  user: {
    displayName: string;
    publicName?: string | null;
    slug: string;
  };
};

type ApiListResponse<T> = { data: T[] };

export function StandingsPage() {
  const { activeSeasonId, isLoading: leagueLoading } = useCurrentLeague();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeSeasonId) {
      setIsLoading(false);
      return;
    }
    const load = async () => {
      try {
        const response = await apiRequest<ApiListResponse<StandingRow>>(`/api/seasons/${activeSeasonId}/standings`);
        setStandings(response.data);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [activeSeasonId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
        <p className="text-muted-foreground mt-1">Current season standings with tiebreaker details.</p>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Player</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Points</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Record</th>
                <th className="text-right p-3 font-medium text-muted-foreground">OMW%</th>
                <th className="text-right p-3 font-medium text-muted-foreground">GW%</th>
                <th className="text-right p-3 font-medium text-muted-foreground">OGW%</th>
              </tr>
            </thead>
            <tbody>
              {leagueLoading || isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading standings...
                  </td>
                </tr>
              ) : standings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No standings data yet. Standings will appear once matches are played.
                  </td>
                </tr>
              ) : (
                standings.map((row, index) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3">
                      <Link className="hover:underline" to={`/profile/${row.user.slug}`}>
                        {primaryName(row.user)}
                      </Link>
                    </td>
                    <td className="p-3 text-right">{row.points}</td>
                    <td className="p-3 text-right">{`${row.matchWins}-${row.matchLosses}-${row.matchDraws}`}</td>
                    <td className="p-3 text-right">{(row.omwPercent * 100).toFixed(1)}</td>
                    <td className="p-3 text-right">{(row.gwPercent * 100).toFixed(1)}</td>
                    <td className="p-3 text-right">{(row.ogwPercent * 100).toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
