import { ReactNode } from 'react';
import { getMatchOutcome } from '@/lib/matchUtils';
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

const TROPHY_PATH =
  'M6 2h12v2h-1v3a5 5 0 0 1-4 4.9V14h3v2H8v-2h3v-2.1A5 5 0 0 1 7 7V4H6V2Zm3 2v3a3 3 0 1 0 6 0V4H9Zm-4 1h2v2a5 5 0 0 0 2.4 4.3 7 7 0 0 1-4.4-6.3V5Zm14 0h-2v2a5 5 0 0 1-2.4 4.3 7 7 0 0 0 4.4-6.3V5Z';

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

function StatsBox({
  record,
  points,
  align = 'left',
  translucent = false,
}: {
  record: MatchRecord;
  points: number;
  align?: 'left' | 'right';
  translucent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-border px-3 py-2 text-xs ${align === 'right' ? 'text-right' : ''} ${
        translucent ? 'bg-background/72 backdrop-blur-[1px]' : 'bg-background'
      }`}
    >
      <p className="text-muted-foreground">
        Event W/L/D: {record.wins}-{record.losses}-{record.draws}
      </p>
      <p className="text-muted-foreground">Season Points: {points}</p>
    </div>
  );
}

function OutcomeWatermark({ isDraw }: { isDraw: boolean }) {
  const pattern = isDraw
    ? 'radial-gradient(circle, rgba(217,119,6,0.09) 1px, transparent 1px)'
    : 'repeating-linear-gradient(135deg, rgba(16,185,129,0.09) 0 1px, transparent 1px 8px)';

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ backgroundImage: pattern, backgroundSize: isDraw ? '8px 8px' : undefined }}>
      {isDraw ? (
        <svg
          className="h-[64%] w-[64%] opacity-[0.28] text-amber-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="7.8" />
          <line x1="8.5" y1="10.3" x2="15.5" y2="10.3" />
          <line x1="8.5" y1="13.7" x2="15.5" y2="13.7" />
        </svg>
      ) : (
        <svg className="h-[64%] w-[64%] opacity-[0.22] text-emerald-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={TROPHY_PATH} />
        </svg>
      )}
    </div>
  );
}

export function MatchCard({ match, eventRecords, seasonPoints, actions, footer }: MatchCardProps) {
  const p1Record = eventRecords.get(match.player1.id) ?? { wins: 0, losses: 0, draws: 0 };
  const p1Points = seasonPoints.get(match.player1.id) ?? 0;
  const matchOutcome = getMatchOutcome(match.status, match.player1.id, match.player2?.id ?? null, match.gameResults);

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
              <StatsBox record={p1Record} points={p1Points} />
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
  const p1IsReportedWinner = matchOutcome === 'player1';
  const p2IsReportedWinner = matchOutcome === 'player2';
  const isReportedDraw = matchOutcome === 'draw';

  return (
    <div className="rounded-lg border-2 border-border bg-card p-3 text-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
        <div className="flex-1 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div
            className={`relative overflow-hidden rounded-lg border p-3 ${
              p1IsReportedWinner
                ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                : isReportedDraw
                  ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                  : 'border-border'
            }`}
          >
            {(p1IsReportedWinner || isReportedDraw) ? <OutcomeWatermark isDraw={isReportedDraw} /> : null}
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <Avatar user={match.player1} sizeClass="h-14 w-14" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{primaryName(match.player1)}</p>
                    {p1IsReportedWinner ? (
                      <span className="rounded-full border border-emerald-600 bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Winner
                      </span>
                    ) : isReportedDraw ? (
                      <span className="rounded-full border border-amber-600 bg-amber-600/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Draw
                      </span>
                    ) : null}
                  </div>
                  {secondaryName(match.player1) ? <p className="text-xs text-muted-foreground truncate">{secondaryName(match.player1)}</p> : null}
                </div>
              </div>
              <div className="mt-3">
                <StatsBox record={p1Record} points={p1Points} translucent={p1IsReportedWinner || isReportedDraw} />
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <span className="h-16 w-16 rounded-full border-2 border-border bg-background flex items-center justify-center text-2xl font-bold tracking-wide">
              VS
            </span>
          </div>

          <div
            className={`relative overflow-hidden rounded-lg border p-3 ${
              p2IsReportedWinner
                ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                : isReportedDraw
                  ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                  : 'border-border'
            }`}
          >
            {(p2IsReportedWinner || isReportedDraw) ? <OutcomeWatermark isDraw={isReportedDraw} /> : null}
            <div className="relative z-10">
              <div className="flex items-center justify-end gap-3">
                <div className="text-right min-w-0">
                  <div className="flex items-center justify-end gap-2">
                    {p2IsReportedWinner ? (
                      <span className="rounded-full border border-emerald-600 bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Winner
                      </span>
                    ) : isReportedDraw ? (
                      <span className="rounded-full border border-amber-600 bg-amber-600/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Draw
                      </span>
                    ) : null}
                    <p className="font-semibold truncate">{primaryName(match.player2)}</p>
                  </div>
                  {secondaryName(match.player2) ? <p className="text-xs text-muted-foreground truncate">{secondaryName(match.player2)}</p> : null}
                </div>
                <Avatar user={match.player2} sizeClass="h-14 w-14" />
              </div>
              <div className="mt-3">
                <StatsBox record={p2Record} points={p2Points} align="right" translucent={p2IsReportedWinner || isReportedDraw} />
              </div>
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
