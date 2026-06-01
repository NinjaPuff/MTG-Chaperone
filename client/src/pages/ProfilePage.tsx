import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiRequest, authApiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { discordHandleRaw, primaryName, profileSubtitle } from '@/lib/userDisplay';

type PublicUser = {
  id: string;
  displayName: string;
  publicName: string | null;
  discordHandle?: string | null;
  slug: string;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  authProvider?: 'google' | 'discord';
};

type PublicProfile = {
  user: PublicUser;
  league: { slug: string; name: string } | null;
  activeSeason: {
    id: string;
    number: number;
    name: string;
    poolVisibility: boolean;
    decklistVisibility: boolean;
    scheduleVisibility: boolean;
  } | null;
  currentStanding: {
    rank: number | null;
    points: number;
    matchWins: number;
    matchLosses: number;
    matchDraws: number;
    omwPercent: number;
    gwPercent: number;
    ogwPercent: number;
  } | null;
  career: {
    seasonsPlayed: number;
    totalMatches: number;
    matchWins: number;
    matchLosses: number;
    matchDraws: number;
    winRate: number;
  };
  seasonHistory: Array<{
    seasonId: string;
    number: number;
    name: string;
    isActive: boolean;
    rank: number | null;
    points: number;
    matchWins: number;
    matchLosses: number;
    matchDraws: number;
  }>;
  links: {
    poolId: string | null;
    poolVisible: boolean;
    decklistsVisible: boolean;
  };
};

type MatchHistoryRow = {
  matchId: string;
  league: { slug: string; name: string };
  season: { id: string; number: number; name: string };
  event: { id: string; name: string };
  round: number;
  opponent: { slug: string; displayName: string; publicName: string | null } | null;
  result: 'win' | 'loss' | 'draw';
  score: string;
  date: string;
};

type MatchHistoryResponse = {
  data: MatchHistoryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type ProfileResponse = { data: PublicProfile };

function formatWinRate(rate: number) {
  return `${Math.round(rate * 1000) / 10}%`;
}

function formatResult(result: MatchHistoryRow['result']) {
  if (result === 'win') return 'Win';
  if (result === 'loss') return 'Loss';
  return 'Draw';
}

function ProfileEditSection({
  user,
  refreshUser,
}: {
  user: PublicUser;
  refreshUser: () => Promise<void>;
}) {
  const [publicName, setPublicName] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSyncedDetails, setShowSyncedDetails] = useState(false);

  useEffect(() => {
    setPublicName(user.publicName ?? '');
    setDiscordHandle(user.discordHandle ?? '');
  }, [user.id, user.publicName, user.discordHandle]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
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
      await authApiRequest('/api/users/profile', {
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

  const isDiscordAuth = user.authProvider === 'discord';
  const syncedDiscordName = discordHandleRaw(user) || user.displayName;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Edit Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">Manage how you appear to other league members.</p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}

      <form className="mt-4 space-y-4" onSubmit={saveProfile}>
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
  );
}

export function ProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user: authUser, isLoading: authLoading, refreshUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryRow[]>([]);
  const [matchPage, setMatchPage] = useState(1);
  const [matchTotalPages, setMatchTotalPages] = useState(0);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug && authUser) {
      navigate(`/profile/${authUser.slug}`, { replace: true });
    }
  }, [slug, authUser, navigate]);

  useEffect(() => {
    if (!slug) {
      return;
    }

    const load = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const response = await apiRequest<ProfileResponse>(`/api/users/${slug}`);
        setProfile(response.data);
      } catch (error) {
        setProfile(null);
        setProfileError(error instanceof ApiError ? error.message : 'Unable to load profile');
      } finally {
        setProfileLoading(false);
      }
    };

    void load();
  }, [slug]);

  const loadMatchHistory = useCallback(
    async (page: number, append: boolean) => {
      if (!slug) {
        return;
      }
      setMatchLoading(true);
      setMatchError(null);
      try {
        const response = await apiRequest<MatchHistoryResponse>(
          `/api/users/${slug}/match-history?page=${page}&limit=20`,
        );
        setMatchHistory((current) => (append ? [...current, ...response.data] : response.data));
        setMatchPage(response.pagination.page);
        setMatchTotalPages(response.pagination.totalPages);
      } catch (error) {
        setMatchError(error instanceof ApiError ? error.message : 'Unable to load match history');
        if (!append) {
          setMatchHistory([]);
        }
      } finally {
        setMatchLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (!slug || !profile) {
      setMatchHistory([]);
      return;
    }
    void loadMatchHistory(1, false);
  }, [slug, profile, loadMatchHistory]);

  if (!slug) {
    if (authLoading) {
      return (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Player Profiles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a player from the{' '}
          <Link to="/standings" className="underline">
            standings
          </Link>{' '}
          to view their profile, or sign in to manage your own.
        </p>
      </div>
    );
  }

  if (profileLoading || (authLoading && !profile)) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-destructive">{profileError ?? 'Profile not found.'}</p>
      </div>
    );
  }

  const displayUser = profile.user;
  const primary = primaryName(displayUser);
  const subtitle = profileSubtitle(displayUser);
  const isOwner = authUser?.slug === slug;
  const record = profile.currentStanding
    ? `${profile.currentStanding.matchWins}-${profile.currentStanding.matchLosses}-${profile.currentStanding.matchDraws}`
    : '0-0-0';
  const careerRecord = `${profile.career.matchWins}-${profile.career.matchLosses}-${profile.career.matchDraws}`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {displayUser.avatarUrl ? (
            <img
              src={displayUser.avatarUrl}
              alt={primary}
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-lg font-semibold">
              {primary.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{primary}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            {profile.league ? (
              <p className="mt-1 text-sm text-muted-foreground">{profile.league.name}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {profile.links.poolVisible && profile.links.poolId ? (
            <Link
              to={`/pools/${profile.links.poolId}`}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              View Card Pool
            </Link>
          ) : profile.links.poolId ? (
            <span className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              Card pool hidden by season privacy
            </span>
          ) : null}
          {profile.links.decklistsVisible ? (
            <Link
              to="/decks"
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Browse Decklists
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              Decklists hidden by season privacy
            </span>
          )}
        </div>
      </div>

      {profile.activeSeason ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">
            Current Season — {profile.activeSeason.name || `Season ${profile.activeSeason.number}`}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Rank</p>
              <p className="text-xl font-bold">
                {profile.currentStanding?.rank ? `#${profile.currentStanding.rank}` : '--'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Points</p>
              <p className="text-xl font-bold">{profile.currentStanding?.points ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Record</p>
              <p className="text-xl font-bold">{record}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Career</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Seasons Played</p>
            <p className="text-xl font-bold">{profile.career.seasonsPlayed}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Matches</p>
            <p className="text-xl font-bold">{profile.career.totalMatches}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Record</p>
            <p className="text-xl font-bold">{careerRecord}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-xl font-bold">{formatWinRate(profile.career.winRate)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Season History</h2>
        {profile.seasonHistory.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No season history yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Season</th>
                  <th className="py-2 pr-4 font-medium">Rank</th>
                  <th className="py-2 pr-4 font-medium">Points</th>
                  <th className="py-2 font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {profile.seasonHistory.map((season) => (
                  <tr key={season.seasonId} className="border-b border-border/60">
                    <td className="py-2 pr-4">
                      {season.name || `Season ${season.number}`}
                      {season.isActive ? ' (current)' : ''}
                    </td>
                    <td className="py-2 pr-4">{season.rank ? `#${season.rank}` : '--'}</td>
                    <td className="py-2 pr-4">{season.points}</td>
                    <td className="py-2">
                      {season.matchWins}-{season.matchLosses}-{season.matchDraws}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Match History</h2>
        {matchError ? <p className="mt-2 text-sm text-destructive">{matchError}</p> : null}
        {matchLoading && matchHistory.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading matches...</p>
        ) : matchHistory.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No matches yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {matchHistory.map((match) => (
              <div
                key={match.matchId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    vs{' '}
                    {match.opponent ? (
                      <Link to={`/profile/${match.opponent.slug}`} className="underline">
                        {primaryName(match.opponent)}
                      </Link>
                    ) : (
                      'BYE'
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {match.event.name} · Round {match.round} ·{' '}
                    {new Date(match.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded border border-border px-2 py-0.5">{match.score}</span>
                  <span className="font-semibold">{formatResult(match.result)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {matchPage < matchTotalPages ? (
          <button
            type="button"
            disabled={matchLoading}
            onClick={() => void loadMatchHistory(matchPage + 1, true)}
            className="mt-4 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {matchLoading ? 'Loading...' : 'Load more'}
          </button>
        ) : null}
      </div>

      {isOwner && authUser ? (
        <ProfileEditSection user={{ ...profile.user, authProvider: authUser.authProvider }} refreshUser={refreshUser} />
      ) : null}
    </div>
  );
}
