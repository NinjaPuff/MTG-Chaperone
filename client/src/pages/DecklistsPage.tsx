export function DecklistsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Decklists</h1>
        <p className="text-muted-foreground mt-1">View and build decklists from your card pool.</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground text-sm">No decklists created yet.</p>
      </div>
    </div>
  );
}
