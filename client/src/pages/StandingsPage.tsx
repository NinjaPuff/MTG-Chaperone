import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PlayerPoolSetSymbols } from '@/components/PlayerPoolSetSymbols';
import { apiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useScryfallSets } from '@/hooks/useScryfallSets';
import { useSeasonPoolSets } from '@/hooks/useSeasonPoolSets';
import { primaryName, profileSubtitle } from '@/lib/userDisplay';

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
    id: string;
    displayName: string;
    publicName?: string | null;
    discordHandle?: string | null;
    slug: string;
  };
};

type ApiListResponse<T> = { data: T[] };

function rowAccentClass(index: number): string {
  if (index === 0) {
    return 'bg-yellow-500/5 border-l-2 border-l-yellow-500';
  }
  if (index === 1) {
    return 'bg-slate-300/5 border-l-2 border-l-slate-400';
  }
  if (index === 2) {
    return 'bg-amber-700/5 border-l-2 border-l-amber-700';
  }
  return '';
}

function RankChip({ index }: { index: number }) {
  if (index > 2) {
    return <>{index + 1}</>;
  }

  const className =
    index === 0
      ? 'bg-yellow-500/15 text-yellow-600'
      : index === 1
        ? 'bg-slate-300/15 text-slate-400'
        : 'bg-amber-700/15 text-amber-600';

  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${className}`}>
      {index + 1}
    </span>
  );
}

export function StandingsPage() {
  const { league, activeSeason, activeSeasonId, isLoading: leagueLoading } = useCurrentLeague();
  const { poolSetsByUserId, isLoading: poolSetsLoading } = useSeasonPoolSets(league?.slug, activeSeason?.number);
  const { getSet } = useScryfallSets();
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
                standings.map((row, index) => {
                  const subtitle = profileSubtitle(row.user);
                  return (
                  <tr key={row.id} className={`border-b border-border last:border-0 ${rowAccentClass(index)}`}>
                    <td className="p-3">
                      <RankChip index={index} />
                    </td>
                    <td className="p-3">
                      <div
                        className={`flex min-h-[2.25rem] flex-col ${subtitle ? 'justify-start' : 'justify-center'}`}
                      >
                        <div className="flex items-center gap-2">
                          <Link className="hover:underline" to={`/profile/${row.user.slug}`}>
                            {primaryName(row.user)}
                          </Link>
                          <PlayerPoolSetSymbols
                            userId={row.user.id}
                            poolSetsByUserId={poolSetsByUserId}
                            poolSetsLoading={poolSetsLoading}
                            getSet={getSet}
                          />
                        </div>
                        {subtitle ? (
                          <p className="text-xs text-muted-foreground">{subtitle}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-right">{row.points}</td>
                    <td className="p-3 text-right">{`${row.matchWins}-${row.matchLosses}-${row.matchDraws}`}</td>
                    <td className="p-3 text-right">{(row.omwPercent * 100).toFixed(1)}</td>
                    <td className="p-3 text-right">{(row.gwPercent * 100).toFixed(1)}</td>
                    <td className="p-3 text-right">{(row.ogwPercent * 100).toFixed(1)}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
