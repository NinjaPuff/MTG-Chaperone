import * as Tabs from '@radix-ui/react-tabs';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SetCodePicker } from '@/components/SetCodePicker';

type League = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
};

type PointConfig = {
  matchWinPoints: number;
  matchDrawPoints: number;
  matchLossPoints: number;
  gameWinPoints: number;
  sweepBonusPoints: number;
};

type Season = {
  id: string;
  name: string;
  number: number;
  tradingEnabled: boolean;
  isActive: boolean;
  poolVisibility: boolean;
  decklistVisibility: boolean;
  scheduleVisibility: boolean;
  pointConfig: PointConfig | null;
};

type InviteLink = {
  id: string;
  token: string;
  status: 'active' | 'revoked';
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
};

type EventConfig = {
  format: 'swiss' | 'seeded_swiss' | 'round_robin';
  bestOfN: number;
  deckCount: number;
  minDeckSize: number;
  sideboardRule: 'entire_pool' | 'fixed_15' | 'none';
  schedulingType: 'fixed_deadlines' | 'open_window' | 'weekly_auto';
  deckLockingMode: 'required_before_round' | 'free_modification' | 'admin_locked';
  seedingSource: 'previous_season' | 'previous_event' | 'manual' | null;
};

type Event = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  pointMultiplier: number;
  standingsOverride: boolean;
  config: EventConfig | null;
};

type BoosterProduct = {
  id: string;
  name: string;
  setReleaseName: string;
  boosterType: 'draft' | 'play' | 'set' | 'collector';
  setCodes: Array<{ id: string; setCode: string }>;
};

type ScryfallSet = {
  code: string;
  name: string;
};

type ApiListResponse<T> = { data: T[] };
type ApiItemResponse<T> = { data: T };

const defaultPointConfig: PointConfig = {
  matchWinPoints: 3,
  matchDrawPoints: 1,
  matchLossPoints: 0,
  gameWinPoints: 0,
  sweepBonusPoints: 0,
};

const defaultEventConfig: EventConfig = {
  format: 'swiss',
  bestOfN: 3,
  deckCount: 1,
  minDeckSize: 40,
  sideboardRule: 'entire_pool',
  schedulingType: 'open_window',
  deckLockingMode: 'free_modification',
  seedingSource: null,
};

function formatBoosterTypeLabel(type: BoosterProduct['boosterType']) {
  switch (type) {
    case 'draft':
      return 'Draft';
    case 'play':
      return 'Play';
    case 'set':
      return 'Set';
    case 'collector':
      return 'Collector';
    default:
      return type;
  }
}

export function AdminPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [boosterProducts, setBoosterProducts] = useState<BoosterProduct[]>([]);
  const [scryfallSets, setScryfallSets] = useState<ScryfallSet[]>([]);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [isBoosterFormOpen, setIsBoosterFormOpen] = useState(false);
  const [nextSeasonName, setNextSeasonName] = useState('');

  const [leagueForm, setLeagueForm] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
  });
  const [inviteForm, setInviteForm] = useState({
    maxUses: '',
    expiresAt: '',
  });
  const [seasonCreateForm, setSeasonCreateForm] = useState({
    name: '',
  });
  const [seasonSettingsForm, setSeasonSettingsForm] = useState({
    name: '',
    tradingEnabled: false,
    poolVisibility: true,
    decklistVisibility: true,
    scheduleVisibility: true,
    pointConfig: defaultPointConfig,
  });
  const [eventForm, setEventForm] = useState({
    name: '',
    pointMultiplier: 1,
    standingsOverride: false,
    config: defaultEventConfig,
  });
  const [boosterForm, setBoosterForm] = useState({
    name: '',
    setReleaseName: '',
    boosterType: 'play' as BoosterProduct['boosterType'],
    primarySet: [] as string[],
    setCodes: [] as string[],
  });

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.slug === selectedLeagueSlug) ?? null,
    [leagues, selectedLeagueSlug],
  );
  const activeSeason = useMemo(
    () => seasons.find((season) => season.isActive) ?? seasons[0] ?? null,
    [seasons],
  );
  const hasActiveEvent = useMemo(() => events.some((event) => event.status === 'active'), [events]);

  const scryfallSetMap = useMemo(() => {
    return new Map(scryfallSets.map((set) => [set.code.toUpperCase(), set.name]));
  }, [scryfallSets]);

  const loadLeagues = async () => {
    const response = await apiRequest<ApiListResponse<League>>('/api/leagues');
    setLeagues(response.data);
    const first = response.data[0] ?? null;
    if (first && !selectedLeagueSlug) {
      setSelectedLeagueSlug(first.slug);
      setLeagueForm({
        name: first.name,
        slug: first.slug,
        description: first.description ?? '',
        logoUrl: first.logoUrl ?? '',
        bannerUrl: first.bannerUrl ?? '',
      });
    }
  };

  const loadSeasons = async (leagueSlug: string) => {
    const response = await apiRequest<ApiListResponse<Season>>(`/api/leagues/${leagueSlug}/seasons`);
    setSeasons(response.data);
    const season = response.data.find((item) => item.isActive) ?? response.data[0];
    if (season) {
      setSeasonSettingsForm({
        name: season.name,
        tradingEnabled: season.tradingEnabled,
        poolVisibility: season.poolVisibility,
        decklistVisibility: season.decklistVisibility,
        scheduleVisibility: season.scheduleVisibility,
        pointConfig: season.pointConfig ?? defaultPointConfig,
      });
    }
  };

  const loadEvents = async (seasonId: string | null) => {
    if (!seasonId) {
      setEvents([]);
      return;
    }
    const response = await apiRequest<ApiListResponse<Event>>(`/api/seasons/${seasonId}/events`);
    setEvents(response.data);
  };

  const loadInvites = async (leagueSlug: string) => {
    const response = await apiRequest<ApiListResponse<InviteLink>>(`/api/leagues/${leagueSlug}/invites`);
    setInvites(response.data);
  };

  const loadBoosterProducts = async () => {
    const response = await apiRequest<ApiListResponse<BoosterProduct>>('/api/booster-products');
    setBoosterProducts(response.data);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadLeagues();
        await loadBoosterProducts();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load admin data');
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadSetLookup = async () => {
      try {
        const response = await apiRequest<ApiListResponse<ScryfallSet>>('/api/sets');
        setScryfallSets(response.data);
      } catch {
        setScryfallSets([]);
      }
    };
    void loadSetLookup();
  }, []);

  useEffect(() => {
    if (!selectedLeagueSlug) {
      setSeasons([]);
      setEvents([]);
      setInvites([]);
      return;
    }

    const load = async () => {
      try {
        await loadSeasons(selectedLeagueSlug);
        await loadInvites(selectedLeagueSlug);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load league details');
      }
    };

    void load();
  }, [selectedLeagueSlug]);

  useEffect(() => {
    void loadEvents(activeSeason?.id ?? null);
  }, [activeSeason?.id]);

  useEffect(() => {
    const primaryCode = boosterForm.primarySet[0] ?? null;
    if (!primaryCode) {
      return;
    }

    const normalizedCode = primaryCode.toUpperCase();
    const name = scryfallSetMap.get(normalizedCode);
    if (name && !boosterForm.setReleaseName) {
      setBoosterForm((prev) => ({ ...prev, setReleaseName: name }));
    }

    if (!boosterForm.name) {
      setBoosterForm((prev) => ({
        ...prev,
        name: `${name ?? normalizedCode} ${formatBoosterTypeLabel(prev.boosterType)} Booster`,
      }));
    }

    if (!boosterForm.setCodes.includes(normalizedCode)) {
      setBoosterForm((prev) => ({
        ...prev,
        setCodes: Array.from(new Set([...prev.setCodes, normalizedCode])),
      }));
    }
  }, [boosterForm.primarySet, boosterForm.boosterType, boosterForm.name, boosterForm.setReleaseName, boosterForm.setCodes, scryfallSetMap]);

  const submitLeague = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const leaguePayload = {
      name: leagueForm.name.trim(),
      slug: leagueForm.slug.trim() || undefined,
      description: leagueForm.description.trim() || null,
      logoUrl: leagueForm.logoUrl.trim() || null,
      bannerUrl: leagueForm.bannerUrl.trim() || null,
    };

    try {
      if (!selectedLeague) {
        const created = await apiRequest<ApiItemResponse<League>>('/api/leagues', {
          method: 'POST',
          body: leaguePayload,
        });
        setSelectedLeagueSlug(created.data.slug);
      } else {
        await apiRequest<ApiItemResponse<League>>(`/api/leagues/${selectedLeague.slug}`, {
          method: 'PATCH',
          body: leaguePayload,
        });
      }
      await loadLeagues();
      setSuccess('League settings saved.');
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Unable to save league settings');
    }
  };

  const createInviteLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLeagueSlug) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/leagues/${selectedLeagueSlug}/invites`, {
        method: 'POST',
        body: {
          maxUses: inviteForm.maxUses ? Number(inviteForm.maxUses) : null,
          expiresAt: inviteForm.expiresAt || null,
        },
      });
      setInviteForm({ maxUses: '', expiresAt: '' });
      await loadInvites(selectedLeagueSlug);
      setSuccess('Invite link created.');
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : 'Unable to create invite');
    }
  };

  const revokeInviteLink = async (inviteId: string) => {
    if (!selectedLeagueSlug) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/leagues/${selectedLeagueSlug}/invites/${inviteId}`, { method: 'DELETE' });
      await loadInvites(selectedLeagueSlug);
      setSuccess('Invite revoked.');
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : 'Unable to revoke invite');
    }
  };

  const createFirstSeason = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLeagueSlug) {
      setError('Create or select a league first, then create a season.');
      return;
    }
    if (!seasonCreateForm.name.trim()) {
      setError('Season name is required.');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/leagues/${selectedLeagueSlug}/seasons`, {
        method: 'POST',
        body: {
          name: seasonCreateForm.name.trim(),
          tradingEnabled: false,
          poolVisibility: true,
          decklistVisibility: true,
          scheduleVisibility: true,
          pointConfig: defaultPointConfig,
        },
      });
      setSeasonCreateForm({ name: '' });
      await loadSeasons(selectedLeagueSlug);
      setSuccess('Season created.');
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : 'Unable to create season');
    }
  };

  const saveSeasonSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLeagueSlug || !activeSeason) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/leagues/${selectedLeagueSlug}/seasons/${activeSeason.number}`, {
        method: 'PATCH',
        body: seasonSettingsForm,
      });
      await loadSeasons(selectedLeagueSlug);
      setSuccess('Season settings saved.');
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Unable to save season settings');
    }
  };

  const createEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeSeason) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/seasons/${activeSeason.id}/events`, {
        method: 'POST',
        body: eventForm,
      });
      setEventForm({
        name: '',
        pointMultiplier: 1,
        standingsOverride: false,
        config: defaultEventConfig,
      });
      setIsEventFormOpen(false);
      await loadEvents(activeSeason.id);
      setSuccess('Event created.');
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : 'Unable to create event');
    }
  };

  const transitionEvent = async (eventId: string, action: 'start' | 'complete') => {
    if (!activeSeason) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/events/${eventId}/${action}`, { method: 'POST' });
      await loadEvents(activeSeason.id);
      setSuccess(`Event ${action}ed.`);
    } catch (transitionError) {
      setError(transitionError instanceof ApiError ? transitionError.message : `Unable to ${action} event`);
    }
  };

  const endSeasonAndStartNew = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLeagueSlug || !activeSeason || !nextSeasonName.trim()) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const created = await apiRequest<ApiItemResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons`, {
        method: 'POST',
        body: {
          name: nextSeasonName.trim(),
          tradingEnabled: activeSeason.tradingEnabled,
          poolVisibility: activeSeason.poolVisibility,
          decklistVisibility: activeSeason.decklistVisibility,
          scheduleVisibility: activeSeason.scheduleVisibility,
          pointConfig: seasonSettingsForm.pointConfig,
        },
      });
      await apiRequest(`/api/leagues/${selectedLeagueSlug}/seasons/${created.data.number}`, {
        method: 'PATCH',
        body: { isActive: true },
      });
      setNextSeasonName('');
      await loadSeasons(selectedLeagueSlug);
      setSuccess('New season created and set active.');
    } catch (lifecycleError) {
      setError(lifecycleError instanceof ApiError ? lifecycleError.message : 'Unable to start next season');
    }
  };

  const autoDetectSetCodes = async () => {
    const setCode = boosterForm.primarySet[0];
    if (!setCode) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const response = await apiRequest<{ data: Record<string, string[]> }>(`/api/mtgjson/${setCode}/boosters`);
      const directMatch = response.data[boosterForm.boosterType];
      const fallback = response.data.default;
      const nextSetCodes = directMatch ?? fallback ?? [];
      if (nextSetCodes.length === 0) {
        setSuccess('No mapping found. Select set codes manually.');
        return;
      }
      setBoosterForm((prev) => ({
        ...prev,
        setCodes: nextSetCodes,
      }));
      setSuccess('Set codes auto-detected from MTGJSON.');
    } catch (detectError) {
      setError(detectError instanceof ApiError ? detectError.message : 'Unable to auto-detect set codes');
    }
  };

  const createBoosterProduct = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiRequest('/api/booster-products', {
        method: 'POST',
        body: {
          name: boosterForm.name,
          setReleaseName: boosterForm.setReleaseName,
          boosterType: boosterForm.boosterType,
          setCodes: boosterForm.setCodes,
        },
      });
      setBoosterForm({
        name: '',
        setReleaseName: '',
        boosterType: 'play',
        primarySet: [],
        setCodes: [],
      });
      setIsBoosterFormOpen(false);
      await loadBoosterProducts();
      setSuccess('Booster product saved.');
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : 'Unable to save booster product');
    }
  };

  const deleteBoosterProduct = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/booster-products/${id}`, { method: 'DELETE' });
      await loadBoosterProducts();
      setSuccess('Booster product deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : 'Unable to delete booster product');
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">You must be signed in to access admin tools.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground mt-1">League setup, current season configuration, and booster products.</p>
        </div>
        {leagues.length > 0 ? (
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={selectedLeagueSlug}
            onChange={(event) => {
              const slug = event.target.value;
              setSelectedLeagueSlug(slug);
              const league = leagues.find((item) => item.slug === slug);
              if (!league) {
                return;
              }
              setLeagueForm({
                name: league.name,
                slug: league.slug,
                description: league.description ?? '',
                logoUrl: league.logoUrl ?? '',
                bannerUrl: league.bannerUrl ?? '',
              });
            }}
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.slug}>
                {league.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

      <Tabs.Root defaultValue="league-settings" className="space-y-4">
        <Tabs.List className="flex flex-wrap gap-2">
          {[
            ['league-settings', 'League Settings'],
            ['current-season', 'Current Season'],
            ['booster-products', 'Booster Products'],
          ].map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="rounded-md border border-border px-3 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="league-settings" className="space-y-6 rounded-lg border border-border bg-card p-6">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitLeague}>
            <label className="text-sm font-medium">
              Name
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={leagueForm.name}
                onChange={(event) => setLeagueForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label className="text-sm font-medium">
              Slug
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={leagueForm.slug}
                onChange={(event) => setLeagueForm((prev) => ({ ...prev, slug: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Description
              <textarea
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={leagueForm.description}
                onChange={(event) => setLeagueForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium">
              Logo URL
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={leagueForm.logoUrl}
                onChange={(event) => setLeagueForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium">
              Banner URL
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={leagueForm.bannerUrl}
                onChange={(event) => setLeagueForm((prev) => ({ ...prev, bannerUrl: event.target.value }))}
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save League Settings
              </button>
            </div>
          </form>

          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold">Invite Links</h3>
            <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={createInviteLink}>
              <label className="text-sm font-medium">
                Max Uses (optional)
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={inviteForm.maxUses}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, maxUses: event.target.value }))}
                />
              </label>
              <label className="text-sm font-medium">
                Expires At (optional)
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={inviteForm.expiresAt}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Add Invite
                </button>
              </div>
            </form>

            <div className="mt-4 space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="rounded-md border border-border p-3">
                  <p className="font-mono text-xs break-all">{`${window.location.origin}/join?token=${invite.token}`}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {invite.status} • Uses {invite.useCount}
                    {invite.maxUses ? `/${invite.maxUses}` : ''} •{' '}
                    {invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleString()}` : 'No expiry'}
                  </p>
                  {invite.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => revokeInviteLink(invite.id)}
                      className="mt-2 rounded-md border border-border px-3 py-1 text-sm"
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              ))}
              {invites.length === 0 ? <p className="text-sm text-muted-foreground">No invites yet.</p> : null}
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="current-season" className="space-y-6 rounded-lg border border-border bg-card p-6">
          {!activeSeason ? (
            <form className="space-y-4" onSubmit={createFirstSeason}>
              <h3 className="text-lg font-semibold">Create First Season</h3>
              {!selectedLeagueSlug ? (
                <p className="text-sm text-muted-foreground">
                  Save league settings first, then create the first season.
                </p>
              ) : null}
              <label className="text-sm font-medium block">
                Season Name
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={seasonCreateForm.name}
                  onChange={(event) => setSeasonCreateForm({ name: event.target.value })}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={!selectedLeagueSlug}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Create Season
              </button>
            </form>
          ) : (
            <>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={saveSeasonSettings}>
                <h3 className="text-lg font-semibold md:col-span-2">
                  Current Season: #{activeSeason.number} - {activeSeason.name}
                </h3>
                <label className="text-sm font-medium">
                  Season Name
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={seasonSettingsForm.name}
                    onChange={(event) => setSeasonSettingsForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </label>
                <label className="mt-6 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={seasonSettingsForm.tradingEnabled}
                    onChange={(event) =>
                      setSeasonSettingsForm((prev) => ({ ...prev, tradingEnabled: event.target.checked }))
                    }
                  />
                  Trading Enabled
                </label>
                <div className="md:col-span-2 grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={seasonSettingsForm.poolVisibility}
                      onChange={(event) =>
                        setSeasonSettingsForm((prev) => ({ ...prev, poolVisibility: event.target.checked }))
                      }
                    />
                    Pool Visibility
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={seasonSettingsForm.decklistVisibility}
                      onChange={(event) =>
                        setSeasonSettingsForm((prev) => ({ ...prev, decklistVisibility: event.target.checked }))
                      }
                    />
                    Decklist Visibility
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={seasonSettingsForm.scheduleVisibility}
                      onChange={(event) =>
                        setSeasonSettingsForm((prev) => ({ ...prev, scheduleVisibility: event.target.checked }))
                      }
                    />
                    Schedule Visibility
                  </label>
                </div>
                <div className="md:col-span-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {Object.keys(defaultPointConfig).map((key) => (
                    <label key={key} className="text-xs font-medium">
                      {key}
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                        value={seasonSettingsForm.pointConfig[key as keyof PointConfig]}
                        onChange={(event) =>
                          setSeasonSettingsForm((prev) => ({
                            ...prev,
                            pointConfig: {
                              ...prev.pointConfig,
                              [key]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Save Season Settings
                  </button>
                </div>
              </form>

              <div className="border-t border-border pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Events</h3>
                  <button
                    type="button"
                    onClick={() => setIsEventFormOpen((prev) => !prev)}
                    className="rounded-md border border-border px-3 py-1 text-sm"
                  >
                    {isEventFormOpen ? 'Cancel' : 'Add New Event'}
                  </button>
                </div>

                {isEventFormOpen ? (
                  <form className="grid gap-4 md:grid-cols-3" onSubmit={createEvent}>
                    <label className="text-sm font-medium">
                      Event Name
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.name}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, name: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Format
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.format}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, format: event.target.value as EventConfig['format'] },
                          }))
                        }
                      >
                        <option value="swiss">Swiss</option>
                        <option value="seeded_swiss">Seeded Swiss</option>
                        <option value="round_robin">Round Robin</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Best Of
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.bestOfN}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, bestOfN: Number(event.target.value) },
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Deck Count
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.deckCount}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, deckCount: Number(event.target.value) },
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Min Deck Size
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.minDeckSize}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, minDeckSize: Number(event.target.value) },
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Point Multiplier
                      <input
                        type="number"
                        min={0.1}
                        step="0.1"
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.pointMultiplier}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, pointMultiplier: Number(event.target.value) }))}
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Sideboard Rule
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.sideboardRule}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, sideboardRule: event.target.value as EventConfig['sideboardRule'] },
                          }))
                        }
                      >
                        <option value="entire_pool">Entire Pool</option>
                        <option value="fixed_15">Fixed 15</option>
                        <option value="none">None</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Scheduling Type
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.schedulingType}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              schedulingType: event.target.value as EventConfig['schedulingType'],
                            },
                          }))
                        }
                      >
                        <option value="fixed_deadlines">Fixed Deadlines</option>
                        <option value="open_window">Open Window</option>
                        <option value="weekly_auto">Weekly Auto</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Deck Locking Mode
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.deckLockingMode}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              deckLockingMode: event.target.value as EventConfig['deckLockingMode'],
                            },
                          }))
                        }
                      >
                        <option value="required_before_round">Required Before Round</option>
                        <option value="free_modification">Free Modification</option>
                        <option value="admin_locked">Admin Locked</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Seeding Source
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.seedingSource ?? ''}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              seedingSource: (event.target.value || null) as EventConfig['seedingSource'],
                            },
                          }))
                        }
                      >
                        <option value="">None</option>
                        <option value="previous_season">Previous Season</option>
                        <option value="previous_event">Previous Event</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm md:col-span-3">
                      <input
                        type="checkbox"
                        checked={eventForm.standingsOverride}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, standingsOverride: event.target.checked }))}
                      />
                      Standings Override
                    </label>
                    <div className="md:col-span-3">
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Save Event
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="mt-4 space-y-3">
                  {events.map((item) => (
                    <div key={item.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.status} • {item.config?.format ?? 'unknown'} • Bo{item.config?.bestOfN ?? '-'} • x
                            {item.pointMultiplier}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {item.status === 'setup' ? (
                            <button
                              type="button"
                              onClick={() => transitionEvent(item.id, 'start')}
                              className="rounded-md border border-border px-3 py-1 text-sm"
                            >
                              Start
                            </button>
                          ) : null}
                          {item.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => transitionEvent(item.id, 'complete')}
                              className="rounded-md border border-border px-3 py-1 text-sm"
                            >
                              Complete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {events.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p> : null}
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold">Season Lifecycle</h3>
                <form className="mt-4 grid gap-3 md:grid-cols-[2fr_auto]" onSubmit={endSeasonAndStartNew}>
                  <input
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={nextSeasonName}
                    onChange={(event) => setNextSeasonName(event.target.value)}
                    placeholder="New season name"
                    required
                    disabled={hasActiveEvent}
                  />
                  <button
                    type="submit"
                    disabled={hasActiveEvent}
                    className="rounded-md border border-border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    End Season & Start New
                  </button>
                </form>
                {hasActiveEvent ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Complete all active events before starting the next season.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </Tabs.Content>

        <Tabs.Content value="booster-products" className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Booster Products</h3>
            <button
              type="button"
              onClick={() => setIsBoosterFormOpen((prev) => !prev)}
              className="rounded-md border border-border px-3 py-1 text-sm"
            >
              {isBoosterFormOpen ? 'Cancel' : 'Add Booster'}
            </button>
          </div>

          {isBoosterFormOpen ? (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={createBoosterProduct}>
              <div className="md:col-span-2">
                <SetCodePicker
                  label="Primary Set"
                  multiple={false}
                  value={boosterForm.primarySet}
                  onChange={(codes) => {
                    const singleCode = codes[0] ? [codes[0]] : [];
                    setBoosterForm((prev) => ({ ...prev, primarySet: singleCode }));
                  }}
                />
              </div>
              <label className="text-sm font-medium">
                Product Name
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={boosterForm.name}
                  onChange={(event) => setBoosterForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Set Release Name
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={boosterForm.setReleaseName}
                  onChange={(event) => setBoosterForm((prev) => ({ ...prev, setReleaseName: event.target.value }))}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Booster Type
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={boosterForm.boosterType}
                  onChange={(event) =>
                    setBoosterForm((prev) => ({
                      ...prev,
                      boosterType: event.target.value as BoosterProduct['boosterType'],
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="play">Play</option>
                  <option value="set">Set</option>
                  <option value="collector">Collector</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={autoDetectSetCodes}
                  disabled={!boosterForm.primarySet[0]}
                  className="rounded-md border border-border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Auto-detect Set Codes
                </button>
              </div>
              <div className="md:col-span-2">
                <SetCodePicker
                  label="Set Codes"
                  value={boosterForm.setCodes}
                  onChange={(codes) => setBoosterForm((prev) => ({ ...prev, setCodes: codes }))}
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save Booster Product
                </button>
              </div>
            </form>
          ) : null}

          <div className="space-y-3">
            {boosterProducts.map((product) => (
              <div key={product.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.setReleaseName} • {product.boosterType}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.setCodes.map((code) => (
                        <span key={code.id} className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground">
                          {code.setCode}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBoosterProduct(product.id)}
                    className="rounded-md border border-border px-3 py-1 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {boosterProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No booster products configured.</p>
            ) : null}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
