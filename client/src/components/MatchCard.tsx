import { ReactNode } from 'react';
import { PlayerPoolSetSymbols } from '@/components/PlayerPoolSetSymbols';
import type { ScryfallSetSummary } from '@/hooks/useScryfallSets';
import type { PoolSetInfo } from '@/hooks/useSeasonPoolSets';
import { getMatchOutcome } from '@/lib/matchUtils';
import { primaryName, profileSubtitle } from '@/lib/userDisplay';

export type MatchCardUser = {
  id: string;
  displayName: string;
  publicName?: string | null;
  discordHandle?: string | null;
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
  poolSetsByUserId?: Map<string, PoolSetInfo>;
  poolSetsLoading?: boolean;
  getSet?: (code: string) => ScryfallSetSummary | undefined;
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
        translucent ? 'bg-background/80' : 'bg-background'
      }`}
    >
      <p className="text-muted-foreground">
        Event W/L/D: {record.wins}-{record.losses}-{record.draws}
      </p>
      <p className="text-muted-foreground">Season Points: {points}</p>
    </div>
  );
}

function PlayerNameWithSets({
  user,
  poolSetsByUserId,
  poolSetsLoading,
  getSet,
  align = 'left',
}: {
  user: MatchCardUser;
  poolSetsByUserId?: Map<string, PoolSetInfo>;
  poolSetsLoading?: boolean;
  getSet?: (code: string) => ScryfallSetSummary | undefined;
  align?: 'left' | 'right';
}) {
  const symbols = poolSetsByUserId ? (
    <PlayerPoolSetSymbols
      userId={user.id}
      poolSetsByUserId={poolSetsByUserId}
      poolSetsLoading={poolSetsLoading}
      getSet={getSet}
    />
  ) : null;

  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
        <p className="font-semibold truncate">{primaryName(user)}</p>
        {symbols}
      </div>
      {profileSubtitle(user) ? (
        <p className="text-xs text-muted-foreground truncate">{profileSubtitle(user)}</p>
      ) : null}
    </div>
  );
}

function OutcomeWatermark({ variant }: { variant: 'winner' | 'disputed' | 'draw' }) {
  const overlay =
    variant === 'disputed'
      ? 'bg-red-500/10'
      : variant === 'draw'
        ? 'bg-amber-500/10'
        : 'bg-emerald-500/10';

  return (
    <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${overlay}`}>
      {variant === 'disputed' ? (
        <svg
          className="h-[58%] w-[58%] opacity-[0.18] text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ) : (
        <svg className="h-[58%] w-[58%] opacity-[0.16] text-emerald-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={TROPHY_PATH} />
        </svg>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  eventRecords,
  seasonPoints,
  poolSetsByUserId,
  poolSetsLoading,
  getSet,
  actions,
  footer,
}: MatchCardProps) {
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
              <PlayerNameWithSets
                user={match.player1}
                poolSetsByUserId={poolSetsByUserId}
                poolSetsLoading={poolSetsLoading}
                getSet={getSet}
              />
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
  const isDisputed = match.status === 'disputed';
  const isReportedDraw = !isDisputed && matchOutcome === 'draw';
  const p1IsReportedWinner = !isDisputed && matchOutcome === 'player1';
  const p2IsReportedWinner = !isDisputed && matchOutcome === 'player2';

  const playerPanelClass = (isWinner: boolean, isDraw: boolean) => {
    if (isDisputed) {
      return 'border-red-500 bg-red-500/10 shadow-sm';
    }
    if (isDraw) {
      return 'border-amber-500 bg-amber-500/10 shadow-sm';
    }
    if (isWinner) {
      return 'border-emerald-500 bg-emerald-500/10 shadow-sm';
    }
    return 'border-border';
  };

  const panelWatermark = (isWinner: boolean, isDraw: boolean) => {
    if (isDisputed) {
      return <OutcomeWatermark variant="disputed" />;
    }
    if (isDraw) {
      return <OutcomeWatermark variant="draw" />;
    }
    if (isWinner) {
      return <OutcomeWatermark variant="winner" />;
    }
    return null;
  };

  const statusBadge = (isWinner: boolean, isDraw: boolean) => {
    if (isDisputed) {
      return (
        <span className="rounded-full border border-red-600 bg-red-600/15 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
          Disputed
        </span>
      );
    }
    if (isDraw) {
      return (
        <span className="rounded-full border border-amber-600 bg-amber-600/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          Draw
        </span>
      );
    }
    if (isWinner) {
      return (
        <span className="rounded-full border border-emerald-600 bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          Winner
        </span>
      );
    }
    return null;
  };

  return (
    <div className="rounded-lg border-2 border-border bg-card p-3 text-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
        <div className="flex-1 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div
            className={`relative overflow-hidden rounded-lg border p-3 ${playerPanelClass(p1IsReportedWinner, isReportedDraw)}`}
          >
            {panelWatermark(p1IsReportedWinner, isReportedDraw)}
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <Avatar user={match.player1} sizeClass="h-14 w-14" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{primaryName(match.player1)}</p>
                    {statusBadge(p1IsReportedWinner, isReportedDraw)}
                    {poolSetsByUserId ? (
                      <PlayerPoolSetSymbols
                        userId={match.player1.id}
                        poolSetsByUserId={poolSetsByUserId}
                        poolSetsLoading={poolSetsLoading}
                        getSet={getSet}
                      />
                    ) : null}
                  </div>
                  {profileSubtitle(match.player1) ? (
                    <p className="text-xs text-muted-foreground truncate">{profileSubtitle(match.player1)}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3">
                <StatsBox
                  record={p1Record}
                  points={p1Points}
                  translucent={isDisputed || p1IsReportedWinner || isReportedDraw}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <span className="h-16 w-16 rounded-full border-2 border-border bg-background flex items-center justify-center text-2xl font-bold tracking-wide">
              VS
            </span>
          </div>

          <div
            className={`relative overflow-hidden rounded-lg border p-3 ${playerPanelClass(p2IsReportedWinner, isReportedDraw)}`}
          >
            {panelWatermark(p2IsReportedWinner, isReportedDraw)}
            <div className="relative z-10">
              <div className="flex items-center justify-end gap-3">
                <div className="text-right min-w-0">
                  <div className="flex items-center justify-end gap-2">
                    {statusBadge(p2IsReportedWinner, isReportedDraw)}
                    <p className="font-semibold truncate">{primaryName(match.player2)}</p>
                    {poolSetsByUserId ? (
                      <PlayerPoolSetSymbols
                        userId={match.player2.id}
                        poolSetsByUserId={poolSetsByUserId}
                        poolSetsLoading={poolSetsLoading}
                        getSet={getSet}
                      />
                    ) : null}
                  </div>
                  {profileSubtitle(match.player2) ? (
                    <p className="text-xs text-muted-foreground truncate">{profileSubtitle(match.player2)}</p>
                  ) : null}
                </div>
                <Avatar user={match.player2} sizeClass="h-14 w-14" />
              </div>
              <div className="mt-3">
                <StatsBox
                  record={p2Record}
                  points={p2Points}
                  align="right"
                  translucent={isDisputed || p2IsReportedWinner || isReportedDraw}
                />
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
