import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '@/lib/api';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { useAuth } from '@/context/AuthContext';

type Event = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  config: { format: string } | null;
};

type Match = {
  id: string;
  status: 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
  player1: { id: string; displayName: string; slug: string };
  player2: { id: string; displayName: string; slug: string } | null;
  gameResults: Array<{ id: string; winnerId: string | null; isDraw: boolean }>;
  isBye: boolean;
  reportedById: string | null;
};

type Round = {
  id: string;
  roundNumber: number;
  status: 'not_started' | 'in_progress' | 'completed';
  matches: Match[];
};

type ApiListResponse<T> = { data: T[] };

export function SchedulePage() {
  const { user } = useAuth();
  const { activeSeasonId } = useCurrentLeague();
  const [events, setEvents] = useState<Event[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [reportWinner, setReportWinner] = useState<'player1' | 'player2' | 'draw'>('player1');
  const [error, setError] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  useEffect(() => {
    if (!activeSeasonId) {
      return;
    }

    const loadEvents = async () => {
      try {
        const response = await apiRequest<ApiListResponse<Event>>(`/api/seasons/${activeSeasonId}/events`);
        setEvents(response.data);
        const active = response.data.find((event) => event.status === 'active') ?? response.data[0] ?? null;
        setSelectedEventId(active?.id ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load events');
      }
    };

    void loadEvents();
  }, [activeSeasonId]);

  useEffect(() => {
    if (!selectedEventId) {
      setRounds([]);
      return;
    }
    const loadRounds = async () => {
      try {
        const response = await apiRequest<ApiListResponse<Round>>(`/api/events/${selectedEventId}/rounds`);
        setRounds(response.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load rounds');
      }
    };
    void loadRounds();
  }, [selectedEventId]);

  const selectedMatch = useMemo(
    () => rounds.flatMap((round) => round.matches).find((match) => match.id === selectedMatchId) ?? null,
    [rounds, selectedMatchId],
  );

  const reportMatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMatch) {
      return;
    }

    const winnerId =
      reportWinner === 'draw'
        ? null
        : reportWinner === 'player1'
          ? selectedMatch.player1.id
          : selectedMatch.player2?.id ?? null;

    try {
      await apiRequest(`/api/matches/${selectedMatch.id}/report`, {
        method: 'POST',
        body: {
          gameResults: [{ winnerId, isDraw: reportWinner === 'draw' }],
        },
      });
      setSelectedMatchId(null);
      if (selectedEventId) {
        const response = await apiRequest<ApiListResponse<Round>>(`/api/events/${selectedEventId}/rounds`);
        setRounds(response.data);
      }
    } catch (reportError) {
      setError(reportError instanceof ApiError ? reportError.message : 'Unable to report match');
    }
  };

  const confirmOrDispute = async (matchId: string, action: 'confirm' | 'dispute') => {
    try {
      await apiRequest(`/api/matches/${matchId}/${action}`, { method: 'POST' });
      if (selectedEventId) {
        const response = await apiRequest<ApiListResponse<Round>>(`/api/events/${selectedEventId}/rounds`);
        setRounds(response.data);
      }
    } catch (matchError) {
      setError(matchError instanceof ApiError ? matchError.message : `Unable to ${action} match`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-muted-foreground mt-1">Current event rounds, pairings, and match reporting.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        {!selectedEvent ? (
          <p className="text-muted-foreground text-sm">No active events. Check back when a new event starts.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{selectedEvent.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedEvent.status} • {selectedEvent.config?.format ?? 'unknown format'}
                </p>
              </div>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedEventId ?? ''}
                onChange={(event) => setSelectedEventId(event.target.value)}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {rounds.map((round) => (
              <div key={round.id} className="rounded-md border border-border p-3">
                <p className="font-medium">
                  Round {round.roundNumber} <span className="text-xs text-muted-foreground">({round.status})</span>
                </p>
                <div className="mt-3 space-y-2">
                  {round.matches.map((match) => {
                    const isParticipant = user && (match.player1.id === user.id || match.player2?.id === user.id);
                    const canReport = isParticipant && match.status === 'pending';
                    const canConfirmOrDispute =
                      isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
                    return (
                      <div
                        key={match.id}
                        className="rounded border border-border p-2 text-sm flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          {match.isBye ? (
                            <span>{match.player1.displayName} -- BYE</span>
                          ) : (
                            <span>{match.player1.displayName} vs {match.player2?.displayName}</span>
                          )}
                          <span className="ml-2 text-xs text-muted-foreground">{match.status}</span>
                        </div>
                        <div className="flex gap-2">
                          {canReport ? (
                            <button
                              type="button"
                              className="rounded-md border border-border px-2 py-1 text-xs"
                              onClick={() => setSelectedMatchId(match.id)}
                            >
                              Report
                            </button>
                          ) : null}
                          {canConfirmOrDispute ? (
                            <>
                              <button
                                type="button"
                                className="rounded-md border border-border px-2 py-1 text-xs"
                                onClick={() => confirmOrDispute(match.id, 'confirm')}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-border px-2 py-1 text-xs"
                                onClick={() => confirmOrDispute(match.id, 'dispute')}
                              >
                                Dispute
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {selectedMatch ? (
        <form onSubmit={reportMatch} className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h3 className="text-lg font-semibold">Report Match</h3>
          <p className="text-sm text-muted-foreground">
            {selectedMatch.player1.displayName} vs {selectedMatch.player2?.displayName}
          </p>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={reportWinner}
            onChange={(event) => setReportWinner(event.target.value as 'player1' | 'player2' | 'draw')}
          >
            <option value="player1">{selectedMatch.player1.displayName} wins</option>
            <option value="player2">{selectedMatch.player2?.displayName ?? 'Opponent'} wins</option>
            <option value="draw">Draw</option>
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Submit Report
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              onClick={() => setSelectedMatchId(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
