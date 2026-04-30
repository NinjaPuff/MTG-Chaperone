export function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-1">League, season, and event management.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="text-lg font-semibold">League Settings</h3>
          <p className="text-muted-foreground text-sm mt-1">Manage branding, privacy, and members.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="text-lg font-semibold">Season Config</h3>
          <p className="text-muted-foreground text-sm mt-1">Create and configure seasons.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="text-lg font-semibold">Event Management</h3>
          <p className="text-muted-foreground text-sm mt-1">Create events, generate pairings, manage rounds.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="text-lg font-semibold">Invite Links</h3>
          <p className="text-muted-foreground text-sm mt-1">Generate and manage league invites.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="text-lg font-semibold">Disputes</h3>
          <p className="text-muted-foreground text-sm mt-1">Review and resolve match disputes.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="text-lg font-semibold">Booster Products</h3>
          <p className="text-muted-foreground text-sm mt-1">Configure booster products and set codes.</p>
        </div>
      </div>
    </div>
  );
}
