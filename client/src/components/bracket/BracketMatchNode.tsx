import {
  BRACKET_NODE_HEIGHT,
  BRACKET_NODE_WIDTH,
  BRACKET_PARTICIPANT_ROW_HEIGHT,
} from './layoutBracket';
import type { ResolvedParticipant } from './resolveSlotParticipants';
import { BracketSlotView } from './types';

type BracketMatchNodeProps = {
  slot: Pick<BracketSlotView, 'slotKey' | 'bracketSide' | 'bracketRound' | 'winnerId' | 'match'>;
  matchLabel: string;
  participants: [ResolvedParticipant, ResolvedParticipant];
  onClick?: () => void;
};

const avatarColorClasses = [
  'bg-sky-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-orange-600',
  'bg-rose-600',
  'bg-cyan-600',
];

function hashToIndex(value: string, modulo: number) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

function scoreLine(
  slot: BracketMatchNodeProps['slot'],
  participants: [ResolvedParticipant, ResolvedParticipant],
) {
  if (!slot.match) {
    return null;
  }
  const player1Id = participants[0].userId;
  const player2Id = participants[1].userId;
  if (!player1Id || !player2Id) {
    return null;
  }

  const player1Wins = slot.match.gameResults.filter((game) => game.winnerId === player1Id).length;
  const player2Wins = slot.match.gameResults.filter((game) => game.winnerId === player2Id).length;
  return `${player1Wins}-${player2Wins}`;
}

function participantNameClass(slot: BracketMatchNodeProps['slot'], participant: ResolvedParticipant) {
  if (participant.isPlaceholder || !participant.userId || !slot.winnerId) {
    return participant.isPlaceholder ? 'italic text-muted-foreground' : 'font-medium text-foreground';
  }
  return slot.winnerId === participant.userId
    ? 'font-semibold text-emerald-600 dark:text-emerald-400'
    : 'font-medium text-muted-foreground';
}

function ParticipantAvatar({ participant }: { participant: ResolvedParticipant }) {
  if (participant.isPlaceholder || !participant.userId) {
    return (
      <div
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted/50 text-[11px] font-semibold text-muted-foreground"
      >
        ?
      </div>
    );
  }

  if (participant.avatarUrl) {
    return (
      <img
        src={participant.avatarUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  const initial = participant.label.trim().charAt(0).toUpperCase() || '?';
  const colorClass = avatarColorClasses[hashToIndex(participant.userId, avatarColorClasses.length)];

  return (
    <div
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-white ${colorClass}`}
    >
      {initial}
    </div>
  );
}

function ParticipantRow({
  slot,
  participant,
  index,
}: {
  slot: BracketMatchNodeProps['slot'];
  participant: ResolvedParticipant;
  index: number;
}) {
  return (
    <div
      style={{ height: BRACKET_PARTICIPANT_ROW_HEIGHT }}
      className={`flex shrink-0 items-center gap-3 overflow-hidden px-2.5 ${
        index === 0 ? 'border-b border-border/70' : ''
      }`}
    >
      <ParticipantAvatar participant={participant} />
      <span
        className={`min-w-0 flex-1 text-[13px] leading-snug ${participantNameClass(slot, participant)} ${
          participant.isPlaceholder ? 'line-clamp-2' : 'truncate'
        }`}
      >
        {participant.label}
      </span>
    </div>
  );
}

export function BracketMatchNode({ slot, matchLabel, participants, onClick }: BracketMatchNodeProps) {
  const clickable = Boolean(onClick && slot.match?.id);
  const score = scoreLine(slot, participants);
  const status = slot.match?.status ?? 'pending';

  return (
    <button
      type="button"
      data-testid={`bracket-node-${slot.slotKey}`}
      onClick={onClick}
      disabled={!clickable}
      style={{ width: BRACKET_NODE_WIDTH, height: BRACKET_NODE_HEIGHT }}
      className={`flex h-full w-full flex-col overflow-hidden rounded-md border bg-card px-3 py-2 text-left shadow-sm transition-colors ${
        clickable ? 'border-primary/40 hover:border-primary hover:bg-accent/40' : 'border-border'
      } disabled:cursor-default`}
    >
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {matchLabel}
        </p>
        {score ? <span className="shrink-0 text-[10px] font-semibold tabular-nums">{score}</span> : null}
      </div>

      <div
        className="shrink-0 overflow-hidden rounded-sm border border-border/70 bg-muted/30"
        style={{ height: BRACKET_PARTICIPANT_ROW_HEIGHT * 2 }}
      >
        {participants.map((participant, index) => (
          <ParticipantRow key={`${slot.slotKey}-${index}`} slot={slot} participant={participant} index={index} />
        ))}
      </div>

      <p className="mt-1 shrink-0 truncate text-[10px] capitalize text-muted-foreground">{status.replace('_', ' ')}</p>
    </button>
  );
}
