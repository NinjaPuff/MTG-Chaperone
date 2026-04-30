export function CardPoolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Card Pools</h1>
        <p className="text-muted-foreground mt-1">Browse player card pools for the current season.</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground text-sm">No card pools registered for this season.</p>
      </div>
    </div>
  );
}
