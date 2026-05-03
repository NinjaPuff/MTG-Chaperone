import { ReactNode } from 'react';
import { primaryName, secondaryName } from '@/lib/userDisplay';

export type MatchCardUser = {
  id: string;
  displayName: string;
  publicName?: string | null;
  avatarUrl?: string | null;
};

export type MatchCardGameResult = {
  winnerId: string | null;
  isDraw: boolean;
};

export type MatchCardMatch = {
  id: string;
  status: string;
  player1: MatchCardUser;
  player2: MatchCardUser | null;
  gameResults: MatchCardGameResult[];
  isBye: boolean;
};

export type MatchRecord = {
  wins: number;
  losses: number;
  draws: number;
};

type MatchCardProps = {
  match: MatchCardMatch;
  eventRecords: Map<string, MatchRecord>;
  seasonPoints: Map<string, number>;
  actions?: ReactNode;
  footer?: ReactNode;
};

function getReportedWinner(match: MatchCardMatch): 'player1' | 'player2' | null {
  if (match.status !== 'reported' || !match.player2) {
    return null;
  }

  let p1Wins = 0;
  let p2Wins = 0;
  for (const game of match.gameResults) {
    if (game.isDraw || !game.winnerId) {
      continue;
    }
    if (game.winnerId === match.player1.id) {
      p1Wins += 1;
      continue;
    }
    if (game.winnerId === match.player2.id) {
      p2Wins += 1;
    }
  }

  if (p1Wins === p2Wins) {
    return null;
  }
  return p1Wins > p2Wins ? 'player1' : 'player2';
}

const avatarColorClasses = [
  'bg-sky-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-orange-600',
  'bg-rose-600',
  'bg-cyan-600',
];

function hashToIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

function Avatar({ user, sizeClass }: { user: MatchCardUser; sizeClass: string }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={primaryName(user)} className={`${sizeClass} rounded-full object-cover border border-border`} />;
  }

  const initial = primaryName(user).trim().charAt(0).toUpperCase() || '?';
  const colorClass = avatarColorClasses[hashToIndex(user.id, avatarColorClasses.length)];

  return (
    <div className={`${sizeClass} rounded-full border border-border text-white font-semibold flex items-center justify-center ${colorClass}`}>
      {initial}
    </div>
  );
}

function StatsBox({ title, record, points, align = 'left' }: { title: string; record: MatchRecord; points: number; align?: 'left' | 'right' }) {
  return (
    <div className={`rounded-md border border-border bg-background px-3 py-2 text-xs ${align === 'right' ? 'text-right' : ''}`}>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-muted-foreground mt-1">
        Event W/L/D: {record.wins}-{record.losses}-{record.draws}
      </p>
      <p className="text-muted-foreground">Season Points: {points}</p>
    </div>
  );
}

export function MatchCard({ match, eventRecords, seasonPoints, actions, footer }: MatchCardProps) {
  const p1Record = eventRecords.get(match.player1.id) ?? { wins: 0, losses: 0, draws: 0 };
  const p1Points = seasonPoints.get(match.player1.id) ?? 0;
  const reportedWinner = getReportedWinner(match);

  if (match.isBye || !match.player2) {
    return (
      <div className="rounded-lg border-2 border-border bg-card p-3 text-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
          <div className="flex-1 rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Avatar user={match.player1} sizeClass="h-14 w-14" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{primaryName(match.player1)}</p>
                {secondaryName(match.player1) ? <p className="text-xs text-muted-foreground truncate">{secondaryName(match.player1)}</p> : null}
              </div>
            </div>
            <div className="mt-3">
              <StatsBox title={primaryName(match.player1)} record={p1Record} points={p1Points} />
            </div>
          </div>
          <div className="w-full md:w-44 rounded-md border border-border px-3 py-2 text-xs flex h-full flex-col gap-2">
            <div className="font-semibold text-center">BYE</div>
            {footer ? <div className="flex-1">{footer}</div> : <div className="flex-1" />}
            {actions ? <div className="mt-auto flex flex-col gap-2">{actions}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  const p2Record = eventRecords.get(match.player2.id) ?? { wins: 0, losses: 0, draws: 0 };
  const p2Points = seasonPoints.get(match.player2.id) ?? 0;
  const p1IsReportedWinner = reportedWinner === 'player1';
  const p2IsReportedWinner = reportedWinner === 'player2';

  return (
    <div className="rounded-lg border-2 border-border bg-card p-3 text-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
        <div className="flex-1 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div
            className={`rounded-lg border p-3 ${
              p1IsReportedWinner ? 'border-emerald-500 bg-emerald-500/10 shadow-sm' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar user={match.player1} sizeClass="h-14 w-14" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{primaryName(match.player1)}</p>
                  {p1IsReportedWinner ? (
                    <span className="rounded-full border border-emerald-600 bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Winner
                    </span>
                  ) : null}
                </div>
                {secondaryName(match.player1) ? <p className="text-xs text-muted-foreground truncate">{secondaryName(match.player1)}</p> : null}
              </div>
            </div>
            <div className="mt-3">
              <StatsBox title={primaryName(match.player1)} record={p1Record} points={p1Points} />
            </div>
          </div>

          <div className="flex justify-center">
            <span className="h-16 w-16 rounded-full border-2 border-border bg-background flex items-center justify-center text-2xl font-bold tracking-wide">
              VS
            </span>
          </div>

          <div
            className={`rounded-lg border p-3 ${
              p2IsReportedWinner ? 'border-emerald-500 bg-emerald-500/10 shadow-sm' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-end gap-3">
              <div className="text-right min-w-0">
                <div className="flex items-center justify-end gap-2">
                  {p2IsReportedWinner ? (
                    <span className="rounded-full border border-emerald-600 bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Winner
                    </span>
                  ) : null}
                  <p className="font-semibold truncate">{primaryName(match.player2)}</p>
                </div>
                {secondaryName(match.player2) ? <p className="text-xs text-muted-foreground truncate">{secondaryName(match.player2)}</p> : null}
              </div>
              <Avatar user={match.player2} sizeClass="h-14 w-14" />
            </div>
            <div className="mt-3">
              <StatsBox title={primaryName(match.player2)} record={p2Record} points={p2Points} align="right" />
            </div>
          </div>
        </div>

        {(footer || actions) ? (
          <div className="w-full xl:w-44 rounded-md border border-border px-3 py-2 text-xs flex h-full flex-col gap-2">
            {footer ? <div className="flex-1">{footer}</div> : <div className="flex-1" />}
            {actions ? <div className="mt-auto flex flex-col gap-2">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
