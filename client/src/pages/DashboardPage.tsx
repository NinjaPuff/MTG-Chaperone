export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">League overview, current season, and recent results.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Next Match</h3>
          <p className="mt-2 text-2xl font-bold">--</p>
          <p className="text-xs text-muted-foreground mt-1">No active events</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Your Record</h3>
          <p className="mt-2 text-2xl font-bold">0-0-0</p>
          <p className="text-xs text-muted-foreground mt-1">Wins - Losses - Draws</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Pool Size</h3>
          <p className="mt-2 text-2xl font-bold">0 cards</p>
          <p className="text-xs text-muted-foreground mt-1">No pool registered</p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Results</h3>
        <p className="text-muted-foreground text-sm">No recent match results.</p>
      </div>
    </div>
  );
}
