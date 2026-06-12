import { ReactNode } from 'react';
import { MatchCard, type MatchCardMatch } from '@/components/MatchCard';
import type { ScryfallSetSummary } from '@/hooks/useScryfallSets';
import type { PoolSetInfo } from '@/hooks/useSeasonPoolSets';
import type { MatchRecord } from '@/components/MatchCard';
import { useConfirm } from '@/context/ConfirmContext';
import { confirmDisputeMatch } from '@/lib/matchDisputeConfirm';
import { primaryName } from '@/lib/userDisplay';

type ParticipantMatch = MatchCardMatch & {
  reportedById: string | null;
  gameResults: Array<{ id?: string; winnerId: string | null; isDraw: boolean }>;
};

type ParticipantRound = {
  status: 'not_started' | 'in_progress' | 'completed';
};

type ParticipantUser = {
  id: string;
  role?: string;
};

type ParticipantMatchCardProps = {
  match: ParticipantMatch;
  round: ParticipantRound;
  user: ParticipantUser | null;
  isAdmin: boolean;
  eventRecords: Map<string, MatchRecord>;
  seasonPoints: Map<string, number>;
  poolSetsByUserId?: Map<string, PoolSetInfo>;
  poolSetsLoading?: boolean;
  getSet?: (code: string) => ScryfallSetSummary | undefined;
  onReport: (matchId: string) => void;
  onConfirm: (matchId: string) => void;
  onDispute: (matchId: string) => void;
};

function matchResultRecord(match: ParticipantMatch) {
  if (!['reported', 'confirmed', 'resolved', 'disputed'].includes(match.status) || match.gameResults.length === 0 || !match.player2) {
    return null;
  }
  const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
  const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
  const draws = match.gameResults.filter((game) => game.isDraw || !game.winnerId).length;
  return `${p1Wins}-${p2Wins}-${draws}`;
}

export function ParticipantMatchCard({
  match,
  round,
  user,
  isAdmin,
  eventRecords,
  seasonPoints,
  poolSetsByUserId,
  poolSetsLoading,
  getSet,
  onReport,
  onConfirm,
  onDispute,
}: ParticipantMatchCardProps) {
  const { confirm } = useConfirm();
  const isParticipant = user && (match.player1.id === user.id || match.player2?.id === user.id);
  const canReport = (isParticipant || isAdmin) && match.status === 'pending' && round.status === 'in_progress';
  const canConfirmOrDispute = isParticipant && match.status === 'reported' && match.reportedById !== user?.id;
  const p1Wins = match.gameResults.filter((game) => game.winnerId === match.player1.id).length;
  const p2Wins = match.gameResults.filter((game) => game.winnerId && game.winnerId === match.player2?.id).length;
  const record = matchResultRecord(match);
  const verdict =
    match.status === 'disputed'
      ? { text: 'Awaiting admin resolution.', tone: 'disputed' as const }
      : ['reported', 'confirmed', 'resolved'].includes(match.status) && match.gameResults.length > 0
        ? p1Wins === p2Wins
          ? { text: 'Match Draw.', tone: 'draw' as const }
          : { text: `${p1Wins > p2Wins ? primaryName(match.player1) : primaryName(match.player2!)} won.`, tone: 'winner' as const }
        : null;

  const actions: ReactNode = (
    <>
      {canReport ? (
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => onReport(match.id)}
        >
          Report
        </button>
      ) : null}
      {canConfirmOrDispute ? (
        <>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={() => onConfirm(match.id)}
          >
            Confirm
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={() => {
              void (async () => {
                if (await confirmDisputeMatch(confirm)) {
                  onDispute(match.id);
                }
              })();
            }}
          >
            Dispute
          </button>
        </>
      ) : null}
    </>
  );

  return (
    <MatchCard
      match={match}
      eventRecords={eventRecords}
      seasonPoints={seasonPoints}
      poolSetsByUserId={poolSetsByUserId}
      poolSetsLoading={poolSetsLoading}
      getSet={getSet}
      footer={
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground capitalize">{match.status.replace('_', ' ')}</p>
          {record ? <p className="text-xs text-muted-foreground">Result: {record}</p> : null}
          {verdict ? (
            <p
              className={`text-xs font-medium ${
                verdict.tone === 'winner'
                  ? 'text-emerald-600'
                  : verdict.tone === 'disputed'
                    ? 'text-red-600'
                    : 'text-amber-600'
              }`}
            >
              {verdict.text}
            </p>
          ) : null}
        </div>
      }
      actions={actions}
    />
  );
}
