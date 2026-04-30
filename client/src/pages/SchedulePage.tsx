export function SchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-muted-foreground mt-1">Current event rounds, pairings, and match reporting.</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground text-sm">No active events. Check back when a new event starts.</p>
      </div>
    </div>
  );
}
