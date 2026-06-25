import {
  BRACKET_NODE_HEIGHT,
  BRACKET_NODE_WIDTH,
  buildBracketMatchLabels,
  layoutBracketSlots,
} from './layoutBracket';
import { BracketConnectors } from './BracketConnectors';
import { BracketMatchNode } from './BracketMatchNode';
import { resolveSlotParticipants } from './resolveSlotParticipants';
import { BracketSlotView } from './types';

type BracketViewProps = {
  slots: BracketSlotView[];
  onMatchClick?: (matchId: string) => void;
  isMatchClickable?: (matchId: string) => boolean;
};

export function BracketView({ slots, onMatchClick, isMatchClickable }: BracketViewProps) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">Bracket will appear after the event starts.</p>;
  }

  const layout = layoutBracketSlots(slots);
  const matchLabels = buildBracketMatchLabels(slots);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-muted/10 p-4">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        {layout.sections
          .filter((section) => section.showLabel !== false)
          .map((section) => (
            <p
              key={section.id}
              className="absolute left-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              style={{ top: section.top }}
            >
              {section.label}
            </p>
          ))}

        <BracketConnectors
          slots={layout.slots}
          nodeWidth={BRACKET_NODE_WIDTH}
          nodeHeight={BRACKET_NODE_HEIGHT}
        />

        {layout.slots.map((slot) => (
          <div
            key={slot.id}
            className="absolute"
            style={{ left: slot.x, top: slot.y, width: BRACKET_NODE_WIDTH, height: BRACKET_NODE_HEIGHT }}
          >
            <BracketMatchNode
              slot={slot}
              matchLabel={matchLabels.get(slot.slotKey) ?? slot.slotKey}
              participants={resolveSlotParticipants(slot, slots, matchLabels)}
              onClick={
                slot.match?.id &&
                onMatchClick &&
                (isMatchClickable?.(slot.match.id) ?? false)
                  ? () => {
                      onMatchClick(slot.match!.id);
                    }
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
