type PoolCardBadgeProps = {
  allocated: number;
  restricted: number;
  restrictionReason?: string;
};

export function PoolCardBadge({ allocated, restricted, restrictionReason }: PoolCardBadgeProps) {
  if (allocated < 1 && restricted < 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-[10px]">
      {allocated > 0 ? (
        <span className="rounded-full border border-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 font-semibold text-emerald-50">
          in deck {allocated}
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

