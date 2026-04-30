import * as Tabs from '@radix-ui/react-tabs';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type League = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  poolVisibility: boolean;
  decklistVisibility: boolean;
  scheduleVisibility: boolean;
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
  pointConfig: PointConfig | null;
};
type InviteLink = {
  id: string;
  token: string;
  status: 'active' | 'revoked';
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
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
type EventFormState = {
  name: string;
  pointMultiplier: number;
  standingsOverride: boolean;
  config: EventConfig;
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

export function AdminPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [boosterProducts, setBoosterProducts] = useState<BoosterProduct[]>([]);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [leagueForm, setLeagueForm] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    poolVisibility: true,
    decklistVisibility: true,
    scheduleVisibility: true,
  });

  const [seasonForm, setSeasonForm] = useState({
    name: '',
    tradingEnabled: false,
    pointConfig: defaultPointConfig,
  });
  const [inviteForm, setInviteForm] = useState({
    maxUses: '',
    expiresAt: '',
  });
  const [eventForm, setEventForm] = useState<EventFormState>({
    name: '',
    pointMultiplier: 1,
    standingsOverride: false,
    config: {
      format: 'swiss' as const,
      bestOfN: 3,
      deckCount: 1,
      minDeckSize: 40,
      sideboardRule: 'entire_pool' as const,
      schedulingType: 'open_window' as const,
      deckLockingMode: 'free_modification' as const,
      seedingSource: null as EventConfig['seedingSource'],
    },
  });
  const [boosterForm, setBoosterForm] = useState({
    name: '',
    setReleaseName: '',
    boosterType: 'play' as BoosterProduct['boosterType'],
    setCodes: '',
  });

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.slug === selectedLeagueSlug) ?? null,
    [leagues, selectedLeagueSlug],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiRequest<ApiListResponse<League>>('/api/leagues');
        setLeagues(response.data);
        if (response.data.length > 0) {
          const first = response.data[0];
          setSelectedLeagueSlug(first.slug);
          setLeagueForm({
            name: first.name,
            slug: first.slug,
            description: first.description ?? '',
            logoUrl: first.logoUrl ?? '',
            bannerUrl: first.bannerUrl ?? '',
            poolVisibility: first.poolVisibility,
            decklistVisibility: first.decklistVisibility,
            scheduleVisibility: first.scheduleVisibility,
          });
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load leagues');
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!selectedLeagueSlug) {
      setSeasons([]);
      return;
    }

    const loadSeasons = async () => {
      try {
        const response = await apiRequest<ApiListResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons`);
        setSeasons(response.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load seasons');
      }
    };

    void loadSeasons();
  }, [selectedLeagueSlug]);

  useEffect(() => {
    if (!selectedLeagueSlug) {
      setEvents([]);
      return;
    }
    const loadEvents = async () => {
      try {
        const seasonsResponse = await apiRequest<ApiListResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons`);
        const activeSeason = seasonsResponse.data.find((season) => season.isActive) ?? seasonsResponse.data[0];
        if (!activeSeason) {
          setEvents([]);
          return;
        }
        const response = await apiRequest<ApiListResponse<Event>>(`/api/seasons/${activeSeason.id}/events`);
        setEvents(response.data);
      } catch {
        setEvents([]);
      }
    };
    void loadEvents();
  }, [selectedLeagueSlug, seasons]);

  useEffect(() => {
    const loadBoosterProducts = async () => {
      try {
        const response = await apiRequest<ApiListResponse<BoosterProduct>>('/api/booster-products');
        setBoosterProducts(response.data);
      } catch {
        setBoosterProducts([]);
      }
    };
    void loadBoosterProducts();
  }, []);

  useEffect(() => {
    if (!selectedLeagueSlug) {
      setInvites([]);
      return;
    }
    const loadInvites = async () => {
      try {
        const response = await apiRequest<ApiListResponse<InviteLink>>(`/api/leagues/${selectedLeagueSlug}/invites`);
        setInvites(response.data);
      } catch {
        // invite list is admin-scoped; leave empty if unauthorized
      }
    };
    void loadInvites();
  }, [selectedLeagueSlug]);

  const refreshLeagues = async () => {
    const response = await apiRequest<ApiListResponse<League>>('/api/leagues');
    setLeagues(response.data);
  };

  const submitLeague = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!selectedLeague) {
        const created = await apiRequest<ApiItemResponse<League>>('/api/leagues', {
          method: 'POST',
          body: leagueForm,
        });
        setSelectedLeagueSlug(created.data.slug);
      } else {
        await apiRequest<ApiItemResponse<League>>(`/api/leagues/${selectedLeague.slug}`, {
          method: 'PATCH',
          body: leagueForm,
        });
      }
      await refreshLeagues();
      setSuccess('League settings saved.');
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Unable to save league settings');
    }
  };

  const submitSeason = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!selectedLeagueSlug) {
      setError('Create a league first.');
      return;
    }

    try {
      await apiRequest<ApiItemResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons`, {
        method: 'POST',
        body: seasonForm,
      });
      const response = await apiRequest<ApiListResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons`);
      setSeasons(response.data);
      setSeasonForm({ name: '', tradingEnabled: false, pointConfig: defaultPointConfig });
      setSuccess('Season created.');
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Unable to create season');
    }
  };

  const toggleSeasonActive = async (seasonNumber: number, isActive: boolean) => {
    if (!selectedLeagueSlug) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<ApiItemResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons/${seasonNumber}`, {
        method: 'PATCH',
        body: { isActive },
      });
      const response = await apiRequest<ApiListResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons`);
      setSeasons(response.data);
      setSuccess('Season status updated.');
    } catch (toggleError) {
      setError(toggleError instanceof ApiError ? toggleError.message : 'Unable to update season');
    }
  };

  const createInviteLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLeagueSlug) {
      setError('Create a league first.');
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
      const response = await apiRequest<ApiListResponse<InviteLink>>(`/api/leagues/${selectedLeagueSlug}/invites`);
      setInvites(response.data);
      setInviteForm({ maxUses: '', expiresAt: '' });
      setSuccess('Invite link created.');
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : 'Unable to create invite');
    }
  };

  const createEventRecord = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLeagueSlug) {
      setError('Create a league first.');
      return;
    }
    const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0];
    if (!activeSeason) {
      setError('Create a season first.');
      return;
    }
    try {
      await apiRequest(`/api/seasons/${activeSeason.id}/events`, {
        method: 'POST',
        body: eventForm,
      });
      const response = await apiRequest<ApiListResponse<Event>>(`/api/seasons/${activeSeason.id}/events`);
      setEvents(response.data);
      setEventForm((prev) => ({ ...prev, name: '' }));
      setSuccess('Event created.');
    } catch (eventError) {
      setError(eventError instanceof ApiError ? eventError.message : 'Unable to create event');
    }
  };

  const transitionEvent = async (eventId: string, action: 'start' | 'complete') => {
    try {
      await apiRequest(`/api/events/${eventId}/${action}`, { method: 'POST' });
      const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0];
      if (!activeSeason) {
        return;
      }
      const response = await apiRequest<ApiListResponse<Event>>(`/api/seasons/${activeSeason.id}/events`);
      setEvents(response.data);
      setSuccess(`Event ${action}ed.`);
    } catch (eventError) {
      setError(eventError instanceof ApiError ? eventError.message : `Unable to ${action} event`);
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
      const response = await apiRequest<ApiListResponse<InviteLink>>(`/api/leagues/${selectedLeagueSlug}/invites`);
      setInvites(response.data);
      setSuccess('Invite revoked.');
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : 'Unable to revoke invite');
    }
  };

  const createBoosterProductRecord = async (event: FormEvent) => {
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
          setCodes: boosterForm.setCodes.split(',').map((code) => code.trim()).filter(Boolean),
        },
      });
      const response = await apiRequest<ApiListResponse<BoosterProduct>>('/api/booster-products');
      setBoosterProducts(response.data);
      setBoosterForm({
        name: '',
        setReleaseName: '',
        boosterType: 'play',
        setCodes: '',
      });
      setSuccess('Booster product saved.');
    } catch (boosterError) {
      setError(boosterError instanceof ApiError ? boosterError.message : 'Unable to save booster product');
    }
  };

  const deleteBoosterProductRecord = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/booster-products/${id}`, { method: 'DELETE' });
      const response = await apiRequest<ApiListResponse<BoosterProduct>>('/api/booster-products');
      setBoosterProducts(response.data);
      setSuccess('Booster product deleted.');
    } catch (boosterError) {
      setError(boosterError instanceof ApiError ? boosterError.message : 'Unable to delete booster product');
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
          <p className="text-muted-foreground mt-1">League, season, and event management.</p>
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
                poolVisibility: league.poolVisibility,
                decklistVisibility: league.decklistVisibility,
                scheduleVisibility: league.scheduleVisibility,
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
            ['seasons', 'Seasons'],
            ['events', 'Events'],
            ['invites', 'Invites'],
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

        <Tabs.Content value="league-settings" className="rounded-lg border border-border bg-card p-6">
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
            <div className="md:col-span-2 grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={leagueForm.poolVisibility}
                  onChange={(event) => setLeagueForm((prev) => ({ ...prev, poolVisibility: event.target.checked }))}
                />
                Pool Visibility
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={leagueForm.decklistVisibility}
                  onChange={(event) =>
                    setLeagueForm((prev) => ({ ...prev, decklistVisibility: event.target.checked }))
                  }
                />
                Decklist Visibility
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={leagueForm.scheduleVisibility}
                  onChange={(event) =>
                    setLeagueForm((prev) => ({ ...prev, scheduleVisibility: event.target.checked }))
                  }
                />
                Schedule Visibility
              </label>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save League Settings
              </button>
            </div>
          </form>
        </Tabs.Content>

        <Tabs.Content value="seasons" className="space-y-4 rounded-lg border border-border bg-card p-6">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitSeason}>
            <label className="text-sm font-medium">
              Season Name
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={seasonForm.name}
                onChange={(event) => setSeasonForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input
                type="checkbox"
                checked={seasonForm.tradingEnabled}
                onChange={(event) => setSeasonForm((prev) => ({ ...prev, tradingEnabled: event.target.checked }))}
              />
              Trading Enabled
            </label>
            <div className="md:col-span-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {Object.keys(defaultPointConfig).map((key) => (
                <label key={key} className="text-xs font-medium">
                  {key}
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={seasonForm.pointConfig[key as keyof PointConfig]}
                    onChange={(event) =>
                      setSeasonForm((prev) => ({
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
                Create Season
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {seasons.map((season) => (
              <div key={season.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">
                    #{season.number} - {season.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {season.isActive ? 'Active' : 'Inactive'} • Trading {season.tradingEnabled ? 'On' : 'Off'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSeasonActive(season.number, true)}
                  disabled={season.isActive}
                  className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
                >
                  {season.isActive ? 'Active' : 'Set Active'}
                </button>
              </div>
            ))}
            {seasons.length === 0 ? <p className="text-sm text-muted-foreground">No seasons yet.</p> : null}
          </div>
        </Tabs.Content>

        <Tabs.Content value="events" className="rounded-lg border border-border bg-card p-6">
          <form className="grid gap-4 md:grid-cols-3" onSubmit={createEventRecord}>
            <label className="text-sm font-medium">
              Event Name
              <input
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={eventForm.name}
                onChange={(event) => setEventForm((prev) => ({ ...prev, name: event.target.value }))}
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
                    config: {
                      ...prev.config,
                      format: event.target.value as EventConfig['format'],
                    },
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
                    config: {
                      ...prev.config,
                      bestOfN: Number(event.target.value),
                    },
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
                    config: {
                      ...prev.config,
                      deckCount: Number(event.target.value),
                    },
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
                    config: {
                      ...prev.config,
                      minDeckSize: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium">
              Point Multiplier
              <input
                type="number"
                step="0.1"
                min={0.1}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={eventForm.pointMultiplier}
                onChange={(event) =>
                  setEventForm((prev) => ({
                    ...prev,
                    pointMultiplier: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <input
                type="checkbox"
                checked={eventForm.standingsOverride}
                onChange={(event) => setEventForm((prev) => ({ ...prev, standingsOverride: event.target.checked }))}
              />
              Standings override
            </label>
            <div className="md:col-span-3">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Create Event
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.status} • {event.config?.format ?? 'unknown'} • Bo{event.config?.bestOfN ?? '-'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {event.status === 'setup' ? (
                      <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1 text-sm"
                        onClick={() => transitionEvent(event.id, 'start')}
                      >
                        Start
                      </button>
                    ) : null}
                    {event.status === 'active' ? (
                      <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1 text-sm"
                        onClick={() => transitionEvent(event.id, 'complete')}
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
        </Tabs.Content>

        <Tabs.Content value="invites" className="rounded-lg border border-border bg-card p-6">
          <form className="grid gap-4 md:grid-cols-3" onSubmit={createInviteLink}>
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
                Create Invite
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
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
        </Tabs.Content>

        <Tabs.Content value="booster-products" className="rounded-lg border border-border bg-card p-6">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createBoosterProductRecord}>
            <label className="text-sm font-medium">
              Product Name
              <input
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={boosterForm.name}
                onChange={(event) => setBoosterForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium">
              Set Release Name
              <input
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={boosterForm.setReleaseName}
                onChange={(event) => setBoosterForm((prev) => ({ ...prev, setReleaseName: event.target.value }))}
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
            <label className="text-sm font-medium">
              Set Codes (comma separated)
              <input
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={boosterForm.setCodes}
                onChange={(event) => setBoosterForm((prev) => ({ ...prev, setCodes: event.target.value }))}
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save Booster Product
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {boosterProducts.map((product) => (
              <div key={product.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.setReleaseName} • {product.boosterType} •{' '}
                      {product.setCodes.map((code) => code.setCode).join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBoosterProductRecord(product.id)}
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
