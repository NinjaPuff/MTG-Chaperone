import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiRequest } from '@/lib/api';
import { primaryName } from '@/lib/userDisplay';

type ApiResponse<T> = { data: T };

type EventResultRow = {
  rank: number;
  userId: string;
  user: {
    id: string;
    displayName: string;
    publicName?: string | null;
    slug: string;
    avatarUrl?: string | null;
  };
  matchPoints: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
};

type EventSummary = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
};

export function EventResultsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [results, setResults] = useState<EventResultRow[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showFullResults, setShowFullResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setError('Missing event id.');
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [eventResponse, resultsResponse] = await Promise.all([
          apiRequest<ApiResponse<EventSummary>>(`/api/events/${eventId}`),
          apiRequest<ApiResponse<EventResultRow[]>>(`/api/events/${eventId}/results`),
        ]);

        if (eventResponse.data.status !== 'completed') {
          navigate(`/events/${eventId}`);
          return;
        }

        setEvent(eventResponse.data);
        setResults(resultsResponse.data);
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load event results');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [eventId, navigate]);

  const revealedPool = useMemo(() => {
    const topRows = results.length > 16 ? results.slice(0, 8) : results;
    return [...topRows].sort((a, b) => b.rank - a.rank);
  }, [results]);

  useEffect(() => {
    if (revealedPool.length === 0) {
      setRevealedCount(0);
      return;
    }
    setRevealedCount(0);
    const timer = setInterval(() => {
      setRevealedCount((count) => {
        if (count >= revealedPool.length) {
          clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, [revealedPool.length]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading event results...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!event) {
    return <p className="text-sm text-destructive">Event not found.</p>;
  }

  const revealedRows = revealedPool.slice(0, revealedCount);
  const animationComplete = revealedCount >= revealedPool.length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-gradient-to-b from-background to-card p-4">
        <p className="text-sm text-muted-foreground">
          <Link to={`/events/${event.id}`} className="underline">
            Event
          </Link>{' '}
          / Final Results
        </p>
        <h1 className="text-3xl font-bold mt-2">{event.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Final placements reveal</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-sm"
          onClick={() => setRevealedCount(revealedPool.length)}
          disabled={animationComplete}
        >
          Skip Animation
        </button>
        {results.length > 16 ? (
          <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => setShowFullResults((value) => !value)}>
            {showFullResults ? 'Hide Full Tournament Results' : 'View Full Tournament Results'}
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {revealedRows.map((row) => (
          <article
            key={row.userId}
            className={`rounded-lg border p-4 transition-all duration-500 ${
              row.rank === 1
                ? 'border-yellow-500 bg-yellow-500/10'
                : row.rank === 2
                  ? 'border-gray-400 bg-gray-400/10'
                  : row.rank === 3
                    ? 'border-amber-700 bg-amber-700/10'
                    : 'border-border bg-card'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">#{row.rank}</span>
                <div>
                  <p className="font-semibold">{primaryName(row.user)}</p>
                  <p className="text-xs text-muted-foreground">
                    Match: {row.matchWins}-{row.matchLosses}-{row.matchDraws} | Game: {row.gameWins}-{row.gameLosses}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold">{row.matchPoints} pts</p>
            </div>
          </article>
        ))}
      </div>

      {animationComplete && revealedRows.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Champion</p>
          <p className="text-2xl font-bold mt-1">{primaryName(revealedRows[revealedRows.length - 1].user)}</p>
        </div>
      ) : null}

      {showFullResults ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="text-lg font-semibold">Full Tournament Results</h2>
          {results.map((row) => (
            <div key={`full-${row.userId}`} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
              <p className="text-sm">
                #{row.rank} {primaryName(row.user)}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.matchWins}-{row.matchLosses}-{row.matchDraws} ({row.matchPoints} pts)
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
