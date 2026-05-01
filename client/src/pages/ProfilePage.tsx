import { FormEvent, useEffect, useState } from 'react';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { primaryName, secondaryName } from '@/lib/userDisplay';

export function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const [publicName, setPublicName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setPublicName(user.publicName ?? '');
    }
  }, [user]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await apiRequest('/api/users/profile', {
        method: 'PATCH',
        body: { publicName: publicName.trim() || null },
      });
      await refreshUser();
      setSuccess('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your profile.</p>
      </div>
    );
  }

  const primary = primaryName(user);
  const secondary = secondaryName(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your public display name and account details.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4 mb-6">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={primary}
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-lg font-semibold">
              {primary.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xl font-semibold">{primary}</p>
            {secondary ? (
              <p className="text-sm text-muted-foreground">{secondary}</p>
            ) : null}
          </div>
        </div>

        <form className="space-y-4" onSubmit={saveProfile}>
          <label className="text-sm font-medium block">
            Public Display Name
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={publicName}
              onChange={(event) => setPublicName(event.target.value)}
              placeholder={user.displayName}
              maxLength={50}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This name is shown across the site instead of your Discord username. Leave blank to use your Discord name.
            </p>
          </label>

          <label className="text-sm font-medium block">
            Discord Username
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
              value={user.displayName}
              disabled
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Synced from your Discord account. Cannot be changed here.
            </p>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
