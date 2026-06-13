type PoolCardBadgeProps = {
  allocated: number;
  allocatedInActiveDeck?: number;
  restricted: number;
  restrictionReason?: string;
};

export function PoolCardBadge({
  allocated,
  allocatedInActiveDeck,
  restricted,
  restrictionReason,
}: PoolCardBadgeProps) {
  const inActiveDeck = Math.max(0, allocatedInActiveDeck ?? allocated);
  const inOtherDecks = Math.max(0, allocated - inActiveDeck);

  if (inActiveDeck < 1 && inOtherDecks < 1 && restricted < 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-[10px]">
      {inActiveDeck > 0 ? (
        <span className="rounded-full border border-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 font-semibold text-emerald-50">
          in deck {inActiveDeck}
        </span>
      ) : null}
      {inOtherDecks > 0 ? (
        <span
          className="rounded-full border border-amber-400/80 bg-amber-950/70 px-1.5 py-0.5 font-semibold text-amber-100"
          title="Allocated in other registered decks, not the active deck"
        >
          other decks {inOtherDecks}
        </span>
      ) : null}
      {restricted > 0 ? (
        <span
          className="rounded-full border border-destructive/70 bg-destructive/80 px-1.5 py-0.5 font-semibold text-destructive-foreground"
          title={restrictionReason ?? `${restricted} restricted copies`}
        >
          ⊘{restricted}
        </span>
      ) : null}
    </div>
  );
}

