export function StandingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
        <p className="text-muted-foreground mt-1">Current season standings with tiebreaker details.</p>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Player</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Points</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Record</th>
                <th className="text-right p-3 font-medium text-muted-foreground">OMW%</th>
                <th className="text-right p-3 font-medium text-muted-foreground">GW%</th>
                <th className="text-right p-3 font-medium text-muted-foreground">OGW%</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No standings data yet. Standings will appear once matches are played.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
