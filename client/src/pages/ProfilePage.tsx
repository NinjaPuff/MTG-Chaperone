import { useAuth } from '@/context/AuthContext';

export function ProfilePage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Your stats, match history, and career record.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Current Season</h3>
          <p className="text-muted-foreground text-sm">
            {isLoading
              ? 'Loading profile...'
              : user
                ? `Signed in as ${user.displayName}. Season stats will appear here.`
                : 'Sign in to view your season record.'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Career Stats</h3>
          <p className="text-muted-foreground text-sm">
            {isLoading ? 'Loading profile...' : user ? `Profile: /profile/${user.slug}` : 'Sign in to view your career history.'}
          </p>
        </div>
      </div>
    </div>
  );
}
