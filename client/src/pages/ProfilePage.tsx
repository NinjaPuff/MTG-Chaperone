import { FormEvent, useEffect, useState } from 'react';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { discordHandleRaw, primaryName, profileSubtitle } from '@/lib/userDisplay';

export function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const [publicName, setPublicName] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSyncedDetails, setShowSyncedDetails] = useState(false);

  useEffect(() => {
    if (user) {
      setPublicName(user.publicName ?? '');
      setDiscordHandle(user.discordHandle ?? '');
    }
  }, [user]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setError(null);
    setSuccess(null);
    setSaving(true);

    const body: { publicName: string | null; discordHandle?: string | null } = {
      publicName: publicName.trim() || null,
    };
    if (user.authProvider === 'google') {
      body.discordHandle = discordHandle.trim() || null;
    }

    try {
      await apiRequest('/api/users/profile', {
        method: 'PATCH',
        body,
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

  const isDiscordAuth = user.authProvider === 'discord';
  const primary = primaryName(user);
  const subtitle = profileSubtitle(user);
  const savedDiscordHandle = discordHandleRaw(user);
  const syncedDiscordName = savedDiscordHandle || user.displayName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage how you appear to other league members.</p>
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
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <form className="space-y-4" onSubmit={saveProfile}>
          <label htmlFor="profile-public-name" className="text-sm font-medium block">
            Public Display Name
            <input
              id="profile-public-name"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={publicName}
              onChange={(event) => setPublicName(event.target.value)}
              placeholder={user.displayName}
              maxLength={50}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Shown across the site instead of your account name. Leave blank to use your account name.
            </p>
          </label>

          {!isDiscordAuth ? (
            <label htmlFor="profile-discord-handle" className="text-sm font-medium block">
              Discord Handle
              <input
                id="profile-discord-handle"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={discordHandle}
                onChange={(event) => setDiscordHandle(event.target.value)}
                placeholder="your_discord_handle"
                maxLength={32}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                How league members can find you on Discord. Optional.
              </p>
            </label>
          ) : null}

          <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground"
              aria-expanded={showSyncedDetails}
              onClick={() => setShowSyncedDetails((open) => !open)}
            >
              {showSyncedDetails ? 'Hide synced account details' : 'Show synced account details'}
            </button>

            {showSyncedDetails ? (
              <div className="mt-3 space-y-4">
                <label htmlFor="profile-account-name" className="text-sm font-medium block">
                  Account Name
                  <input
                    id="profile-account-name"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
                    value={user.displayName}
                    disabled
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Synced from your sign-in provider.
                  </p>
                </label>

                {isDiscordAuth ? (
                  <label htmlFor="profile-discord-name" className="text-sm font-medium block">
                    Discord Username
                    <input
                      id="profile-discord-name"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
                      value={syncedDiscordName}
                      disabled
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Synced from your Discord account.
                    </p>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>

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
