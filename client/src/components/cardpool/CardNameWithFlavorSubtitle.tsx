type CardNameWithFlavorSubtitleProps = {
  name: string;
  flavorName?: string | null;
  nameClassName?: string;
};

function shouldShowFlavorSubtitle(name: string, flavorName?: string | null): boolean {
  const trimmed = flavorName?.trim();
  if (!trimmed) {
    return false;
  }
  return trimmed.toLowerCase() !== name.trim().toLowerCase();
}

export function CardNameWithFlavorSubtitle({
  name,
  flavorName,
  nameClassName = 'font-medium',
}: CardNameWithFlavorSubtitleProps) {
  const showFlavor = shouldShowFlavorSubtitle(name, flavorName);

  return (
    <div className="min-w-0">
      <p className={nameClassName}>{name}</p>
      {showFlavor ? (
        <p className="truncate text-xs text-muted-foreground">{flavorName?.trim()}</p>
      ) : null}
    </div>
  );
}
