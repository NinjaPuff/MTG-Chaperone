import * as Tabs from '@radix-ui/react-tabs';
import { Copy } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, authApiRequest } from '@/lib/api';
import { hasRemovedSetCodes } from '@/lib/boosterProductEditGuards';
import { resolveCreatePrimarySetCode } from '@/lib/boosterProductCreate';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { buildInviteJoinUrl, copyTextToClipboard } from '@/lib/inviteLink';
import { SetCodePicker } from '@/components/SetCodePicker';
import { BoosterProductSetBadges } from '@/components/BoosterProductSetBadges';
import {
  BoosterProductCacheControls,
  type SetCacheStat,
} from '@/components/admin/BoosterProductCacheControls';
import {
  StaleCacheReferencesDialog,
  type ResolveStaleAction,
  type StaleReference,
} from '@/components/admin/StaleCacheReferencesDialog';
import { SetSymbolGroup } from '@/components/SetSymbolGroup';
import { primaryName, profileSubtitle } from '@/lib/userDisplay';
import { isBracketFormat } from '@mtg-league/shared';
import { minDeckSizeSelectOptions } from '@/lib/minDeckSize';

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
  format: 'swiss' | 'seeded_swiss' | 'round_robin' | 'single_elimination' | 'double_elimination' | 'custom_10_player';
  bestOfN: number;
  deckCount: number;
  minDeckSize: number;
  sideboardRule: 'entire_pool' | 'fixed_15' | 'none';
  schedulingType: 'fixed_deadlines' | 'open_window' | 'weekly_auto';
  deckLockingMode: 'required_before_round' | 'free_modification' | 'admin_locked';
  seedingSource: 'previous_season' | 'previous_event' | 'current_season' | 'manual' | null;
  grandFinalsReset?: boolean;
};

type Event = {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  pointMultiplier: number;
  standingsOverride: boolean;
  config: EventConfig | null;
  rounds?: Array<{ status: 'not_started' | 'in_progress' | 'completed' }>;
};

type BoosterProduct = {
  id: string;
  name: string;
  setReleaseName: string;
  boosterType: 'draft' | 'play' | 'set' | 'collector';
  primarySetCode?: string | null;
  setCodes: Array<{ id: string; setCode: string }>;
};

type Member = {
  id: string;
  userId?: string;
  joinedAt: string;
  user: {
    id: string;
    displayName: string;
    publicName?: string | null;
    discordHandle?: string | null;
    slug: string;
    avatarUrl: string | null;
  };
};

type CardPoolSummary = {
  id: string;
  userId?: string;
  user?: { id: string };
  boosterProductId: string;
  boosterProduct: {
    id: string;
    name: string;
    boosterType: BoosterProduct['boosterType'];
  };
};

type SiteUser = {
  id: string;
  displayName: string;
  publicName?: string | null;
  discordHandle?: string | null;
  slug: string;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  createdAt: string;
};

type ScryfallSet = {
  code: string;
  name: string;
  icon_svg_uri: string | null;
};

type ApiListResponse<T> = { data: T[] };
type ApiItemResponse<T> = { data: T };
type ApiSeriesResponse<T> = { data: T[] };

type ClearAndImportResult = SetCacheStat & {
  imported: number;
  deleted: number;
  deletedCards: Array<{ scryfallId: string; name: string; setCode: string }>;
  error?: string;
};

type ClearAndImportResponse = {
  data: {
    results: ClearAndImportResult[];
    totalImported: number;
    totalDeleted: number;
    deletedCards: Array<{ scryfallId: string; name: string; setCode: string }>;
    staleReferences: StaleReference[];
  };
};

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
  grandFinalsReset: false,
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

function matchesBoosterProductSearch(product: BoosterProduct, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }

  return (
    product.name.toLowerCase().includes(q) ||
    product.setReleaseName.toLowerCase().includes(q) ||
    product.boosterType.toLowerCase().includes(q) ||
    product.setCodes.some((entry) => entry.setCode.toLowerCase().includes(q))
  );
}

/** Stable row id for league membership APIs (some payloads omit userId; user.id is always present). */
function membershipRowUserId(member: Member) {
  return member.userId ?? member.user.id;
}

function poolOwnerUserId(pool: CardPoolSummary) {
  return pool.userId ?? pool.user?.id ?? '';
}

function formatMutationError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.fields && Object.keys(err.fields).length > 0) {
      const detail = Object.entries(err.fields)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      return `${err.message} (${detail})`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export function AdminPage() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [boosterProducts, setBoosterProducts] = useState<BoosterProduct[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cardPools, setCardPools] = useState<CardPoolSummary[]>([]);
  const [poolAssignments, setPoolAssignments] = useState<Record<string, string>>({});
  const [siteUsers, setSiteUsers] = useState<SiteUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [boosterProductSearch, setBoosterProductSearch] = useState('');
  const [cacheStatsBySetCode, setCacheStatsBySetCode] = useState<Record<string, SetCacheStat>>({});
  const [importingSetCode, setImportingSetCode] = useState<string | null>(null);
  const [importingProductId, setImportingProductId] = useState<string | null>(null);
  const [clearingSetCode, setClearingSetCode] = useState<string | null>(null);
  const [clearingProductId, setClearingProductId] = useState<string | null>(null);
  const [clearingAllSets, setClearingAllSets] = useState(false);
  const [staleDialogDeletedCards, setStaleDialogDeletedCards] = useState<
    Array<{ scryfallId: string; name: string; setCode: string }>
  >([]);
  const [staleDialogReferences, setStaleDialogReferences] = useState<StaleReference[]>([]);
  const [resolvingStaleReferences, setResolvingStaleReferences] = useState(false);
  const [scryfallSets, setScryfallSets] = useState<ScryfallSet[]>([]);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventForm, setEditEventForm] = useState({
    name: '',
    pointMultiplier: 1,
    standingsOverride: false,
    config: defaultEventConfig,
  });
  const [isBoosterFormOpen, setIsBoosterFormOpen] = useState(false);
  const [editingBoosterId, setEditingBoosterId] = useState<string | null>(null);
  const [editBoosterForm, setEditBoosterForm] = useState({
    name: '',
    setReleaseName: '',
    boosterType: 'play' as BoosterProduct['boosterType'],
    primarySet: [] as string[],
    setCodes: [] as string[],
  });
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
  const [roundRobinSeriesForm, setRoundRobinSeriesForm] = useState({
    baseName: 'Round Robin',
    roundsPerEvent: 3,
    pointMultiplier: 1,
    standingsOverride: false,
  });
  const [boosterForm, setBoosterForm] = useState({
    name: '',
    setReleaseName: '',
    boosterType: 'play' as BoosterProduct['boosterType'],
    seedSet: [] as string[],
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
  const poolsByUserId = useMemo(() => {
    const map = new Map<string, CardPoolSummary>();
    for (const pool of cardPools) {
      const uid = poolOwnerUserId(pool);
      if (uid) {
        map.set(uid, pool);
      }
    }
    return map;
  }, [cardPools]);

  const scryfallSetMap = useMemo(() => {
    return new Map(scryfallSets.map((set) => [set.code.toUpperCase(), set.name]));
  }, [scryfallSets]);

  const getSet = useMemo(
    () => (code: string) => {
      const normalized = code.trim().toUpperCase();
      return scryfallSets.find((set) => set.code.toUpperCase() === normalized);
    },
    [scryfallSets],
  );

  const sortedBoosterProducts = useMemo(
    () => [...boosterProducts].sort((a, b) => a.name.localeCompare(b.name)),
    [boosterProducts],
  );

  const filteredBoosterProducts = useMemo(() => {
    const q = boosterProductSearch.trim();
    if (!q) {
      return sortedBoosterProducts;
    }

    return sortedBoosterProducts.filter((product) => matchesBoosterProductSearch(product, q));
  }, [sortedBoosterProducts, boosterProductSearch]);

  const allBoosterSetCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const product of boosterProducts) {
      for (const entry of product.setCodes) {
        codes.add(entry.setCode);
      }
    }
    return [...codes].sort((a, b) => a.localeCompare(b));
  }, [boosterProducts]);

  const mergeCacheStats = (stats: SetCacheStat[]) => {
    setCacheStatsBySetCode((previous) => {
      const next = { ...previous };
      for (const stat of stats) {
        next[stat.setCode] = stat;
      }
      return next;
    });
  };

  const loadLeagues = async () => {
    const response = await authApiRequest<ApiListResponse<League>>('/api/leagues');
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
    const response = await authApiRequest<ApiListResponse<Season>>(`/api/leagues/${leagueSlug}/seasons`);
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
    const response = await authApiRequest<ApiListResponse<Event>>(`/api/seasons/${seasonId}/events`);
    setEvents(response.data);
  };

  const loadInvites = async (leagueSlug: string) => {
    const response = await authApiRequest<ApiListResponse<InviteLink>>(`/api/leagues/${leagueSlug}/invites`);
    setInvites(response.data);
  };

  const loadMembers = async (leagueSlug: string) => {
    const response = await authApiRequest<ApiListResponse<Member>>(`/api/leagues/${leagueSlug}/members`);
    setMembers(response.data);
  };

  const loadCardPools = async (leagueSlug: string, seasonNumber: number) => {
    const response = await authApiRequest<ApiListResponse<CardPoolSummary>>(
      `/api/leagues/${leagueSlug}/seasons/${seasonNumber}/pools`,
    );
    setCardPools(response.data);
    setPoolAssignments((prev) => {
      const next = { ...prev };
      for (const pool of response.data) {
        const uid = poolOwnerUserId(pool);
        if (uid) {
          next[uid] = pool.boosterProductId;
        }
      }
      return next;
    });
  };

  const loadBoosterProducts = async () => {
    const response = await authApiRequest<ApiListResponse<BoosterProduct>>('/api/booster-products');
    setBoosterProducts(response.data);
  };

  const loadCacheStats = async (setCodes: string[]) => {
    if (setCodes.length === 0) {
      setCacheStatsBySetCode({});
      return;
    }

    const response = await authApiRequest<ApiListResponse<SetCacheStat>>(
      `/api/admin/card-cache/stats?setCodes=${encodeURIComponent(setCodes.join(','))}`,
    );
    setCacheStatsBySetCode(Object.fromEntries(response.data.map((stat) => [stat.setCode, stat])));
  };

  const importSetToCache = async (setCode: string) => {
    setImportingSetCode(setCode);
    setError(null);
    try {
      const response = await authApiRequest<{
        data: { results: SetCacheStat[]; totalImported: number };
      }>('/api/admin/card-cache/import-set', {
        method: 'POST',
        body: { setCode },
      });
      mergeCacheStats(response.data.results);
      showToast({
        message: `Imported ${response.data.totalImported} cards for ${setCode}`,
        variant: 'success',
      });
    } catch (importError) {
      const message = importError instanceof ApiError ? importError.message : 'Unable to import set';
      setError(message);
      showToast({ message, variant: 'default' });
    } finally {
      setImportingSetCode(null);
    }
  };

  const importBoosterProductToCache = async (productId: string) => {
    const product = boosterProducts.find((entry) => entry.id === productId);
    const confirmed = await confirm({
      title: 'Import all sets to cache',
      message: `Import all cards for "${product?.name ?? 'this booster product'}"? Each configured set is imported from Scryfall and may take up to a minute.`,
      confirmLabel: 'Import',
    });
    if (!confirmed) {
      return;
    }

    setImportingProductId(productId);
    setError(null);
    try {
      const response = await authApiRequest<{
        data: { results: Array<SetCacheStat & { imported: number }>; totalImported: number };
      }>(`/api/admin/card-cache/import-booster-product/${productId}`, {
        method: 'POST',
      });
      mergeCacheStats(response.data.results);
      const failedSets = response.data.results.filter((result) => 'error' in result && result.error);
      showToast({
        message:
          failedSets.length > 0
            ? `Imported ${response.data.totalImported} cards; ${failedSets.length} set(s) failed`
            : `Imported ${response.data.totalImported} cards across ${response.data.results.length} sets`,
        variant: failedSets.length > 0 ? 'default' : 'success',
      });
    } catch (importError) {
      const message =
        importError instanceof ApiError ? importError.message : 'Unable to import booster product sets';
      setError(message);
      showToast({ message, variant: 'default' });
    } finally {
      setImportingProductId(null);
    }
  };

  const applyClearAndImportResponse = (response: ClearAndImportResponse['data']) => {
    mergeCacheStats(response.results);
    setStaleDialogDeletedCards(response.deletedCards);
    setStaleDialogReferences(response.staleReferences);
    const failedSets = response.results.filter((result) => Boolean(result.error));
    showToast({
      message:
        failedSets.length > 0
          ? `Cleared ${response.totalDeleted}, imported ${response.totalImported}; ${failedSets.length} set(s) failed to import`
          : response.staleReferences.length > 0
            ? `Cleared ${response.totalDeleted}, imported ${response.totalImported}; ${response.staleReferences.length} stale card(s) need review`
            : `Cleared ${response.totalDeleted}, imported ${response.totalImported}`,
      variant: failedSets.length > 0 ? 'default' : 'success',
    });
  };

  const clearAndImportSetToCache = async (setCode: string) => {
    const confirmed = await confirm({
      title: `Clear & re-import ${setCode}`,
      message:
        'This clears unreferenced cached cards for this set, re-imports paper printings, then highlights any cards still in pools or decklists.',
      confirmLabel: 'Clear & re-import',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setClearingSetCode(setCode);
    setError(null);
    try {
      const response = await authApiRequest<ClearAndImportResponse>('/api/admin/card-cache/clear-and-import-set', {
        method: 'POST',
        body: { setCode },
      });
      applyClearAndImportResponse(response.data);
    } catch (clearError) {
      const message = clearError instanceof ApiError ? clearError.message : 'Unable to clear and re-import set';
      setError(message);
      showToast({ message, variant: 'default' });
    } finally {
      setClearingSetCode(null);
    }
  };

  const clearAndImportBoosterProductToCache = async (productId: string) => {
    const product = boosterProducts.find((entry) => entry.id === productId);
    const confirmed = await confirm({
      title: 'Clear & re-import all sets',
      message: `Clear unreferenced cache rows and re-import all sets for "${product?.name ?? 'this booster product'}"?`,
      confirmLabel: 'Clear & re-import',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setClearingProductId(productId);
    setError(null);
    try {
      const response = await authApiRequest<ClearAndImportResponse>(
        `/api/admin/card-cache/clear-and-import-booster-product/${productId}`,
        { method: 'POST' },
      );
      applyClearAndImportResponse(response.data);
    } catch (clearError) {
      const message =
        clearError instanceof ApiError ? clearError.message : 'Unable to clear and re-import booster product sets';
      setError(message);
      showToast({ message, variant: 'default' });
    } finally {
      setClearingProductId(null);
    }
  };

  const clearAndImportAllBoosterSets = async () => {
    const confirmed = await confirm({
      title: 'Clear & re-import all sets',
      message:
        'Clear unreferenced cache rows and re-import every set currently configured across booster products. In-use pool/decklist cards will be shown for review.',
      confirmLabel: 'Clear & re-import all',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setClearingAllSets(true);
    setError(null);
    try {
      const response = await authApiRequest<ClearAndImportResponse>('/api/admin/card-cache/clear-and-import-sets', {
        method: 'POST',
        body: { setCodes: allBoosterSetCodes },
      });
      applyClearAndImportResponse(response.data);
    } catch (clearError) {
      const message = clearError instanceof ApiError ? clearError.message : 'Unable to clear and re-import all sets';
      setError(message);
      showToast({ message, variant: 'default' });
    } finally {
      setClearingAllSets(false);
    }
  };

  const resolveStaleDialogActions = async (actions: ResolveStaleAction[]) => {
    if (actions.length === 0) {
      return;
    }

    setResolvingStaleReferences(true);
    setError(null);
    try {
      const response = await authApiRequest<{ data: { resolved: number; errors: Array<{ message: string }> } }>(
        '/api/admin/card-cache/resolve-stale-references',
        {
          method: 'POST',
          body: { actions },
        },
      );
      const { resolved, errors } = response.data;
      showToast({
        message:
          errors.length > 0
            ? `Resolved ${resolved} stale entries; ${errors.length} action(s) failed`
            : `Resolved ${resolved} stale entries`,
        variant: errors.length > 0 ? 'default' : 'success',
      });

      await loadCacheStats(allBoosterSetCodes);
      if (errors.length === 0) {
        setStaleDialogReferences([]);
        setStaleDialogDeletedCards([]);
      }
    } catch (resolveError) {
      const message = resolveError instanceof ApiError ? resolveError.message : 'Unable to resolve stale references';
      setError(message);
      showToast({ message, variant: 'default' });
    } finally {
      setResolvingStaleReferences(false);
    }
  };

  const loadSiteUsers = async () => {
    const response = await authApiRequest<ApiListResponse<SiteUser>>('/api/users');
    setSiteUsers(response.data);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([loadLeagues(), loadBoosterProducts(), loadSiteUsers()]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load admin data');
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      return;
    }

    void loadCacheStats(allBoosterSetCodes).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load card cache stats');
    });
  }, [allBoosterSetCodes, user]);

  useEffect(() => {
    const loadSetLookup = async () => {
      try {
        const response = await authApiRequest<ApiListResponse<ScryfallSet>>('/api/sets');
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
      setMembers([]);
      setCardPools([]);
      setPoolAssignments({});
      return;
    }

    const load = async () => {
      try {
        await Promise.all([loadSeasons(selectedLeagueSlug), loadInvites(selectedLeagueSlug), loadMembers(selectedLeagueSlug)]);
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
    const load = async () => {
      if (!selectedLeagueSlug || !activeSeason) {
        setCardPools([]);
        return;
      }

      try {
        await loadCardPools(selectedLeagueSlug, activeSeason.number);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load card pools');
      }
    };

    void load();
  }, [selectedLeagueSlug, activeSeason?.number]);

  useEffect(() => {
    if (boosterProducts.length === 0) {
      return;
    }

    const defaultBoosterId = sortedBoosterProducts[0]?.id;
    if (!defaultBoosterId) {
      return;
    }
    setPoolAssignments((prev) => {
      const next = { ...prev };
      for (const member of members) {
        const uid = membershipRowUserId(member);
        const hasPool = poolsByUserId.has(uid);
        if (!hasPool && !next[uid]) {
          next[uid] = defaultBoosterId;
        }
      }
      return next;
    });
  }, [members, poolsByUserId, sortedBoosterProducts]);

  useEffect(() => {
    const primaryCode = boosterForm.seedSet[0] ?? null;
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
  }, [boosterForm.seedSet, boosterForm.boosterType, boosterForm.name, boosterForm.setReleaseName, boosterForm.setCodes, scryfallSetMap]);

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
        const created = await authApiRequest<ApiItemResponse<League>>('/api/leagues', {
          method: 'POST',
          body: leaguePayload,
        });
        setSelectedLeagueSlug(created.data.slug);
      } else {
        await authApiRequest<ApiItemResponse<League>>(`/api/leagues/${selectedLeague.slug}`, {
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
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/invites`, {
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

    const confirmed = await confirm({
      title: 'Revoke invite link',
      message: 'Revoke this invite link? New players will no longer be able to use it.',
      confirmLabel: 'Revoke',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/invites/${inviteId}`, { method: 'DELETE' });
      await loadInvites(selectedLeagueSlug);
      setSuccess('Invite revoked.');
    } catch (inviteError) {
      setError(inviteError instanceof ApiError ? inviteError.message : 'Unable to revoke invite');
    }
  };

  const copyInviteLink = async (token: string) => {
    try {
      await copyTextToClipboard(buildInviteJoinUrl(token));
      showToast({ message: 'Invite link copied', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to copy invite link' });
    }
  };

  const createFirstSeason = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLeagueSlug) {
      const message = 'Save league settings on the League Settings tab before creating a season.';
      setError(message);
      showToast({ message, variant: 'default' });
      return;
    }
    if (!seasonCreateForm.name.trim()) {
      setError('Season name is required.');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/seasons`, {
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
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/seasons/${activeSeason.number}`, {
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
      await authApiRequest(`/api/seasons/${activeSeason.id}/events`, {
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

  const startEditEvent = (item: Event) => {
    setEditingEventId(item.id);
    setEditEventForm({
      name: item.name,
      pointMultiplier: item.pointMultiplier,
      standingsOverride: item.standingsOverride,
      config: item.config ?? defaultEventConfig,
    });
  };

  const cancelEditEvent = () => {
    setEditingEventId(null);
  };

  const saveEditEvent = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!activeSeason || !editingEventId) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/events/${editingEventId}`, {
        method: 'PATCH',
        body: {
          name: editEventForm.name.trim(),
          pointMultiplier: editEventForm.pointMultiplier,
          standingsOverride: editEventForm.standingsOverride,
          config: editEventForm.config,
        },
      });
      setEditingEventId(null);
      await loadEvents(activeSeason.id);
      setSuccess('Event settings saved.');
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Unable to save event settings');
    }
  };

  const createRoundRobinSeries = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeSeason) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const response = await authApiRequest<ApiSeriesResponse<Event>>(`/api/seasons/${activeSeason.id}/events/round-robin-series`, {
        method: 'POST',
        body: {
          baseName: roundRobinSeriesForm.baseName.trim(),
          roundsPerEvent: roundRobinSeriesForm.roundsPerEvent,
          pointMultiplier: roundRobinSeriesForm.pointMultiplier,
          standingsOverride: roundRobinSeriesForm.standingsOverride,
        },
      });
      await loadEvents(activeSeason.id);
      setSuccess(
        `${response.data.length} round-robin event${response.data.length === 1 ? '' : 's'} generated with prebuilt pairings.`,
      );
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : 'Unable to generate round robin event series');
    }
  };

  const transitionEvent = async (eventId: string, action: 'start' | 'complete') => {
    if (!activeSeason) {
      return;
    }

    const eventItem = events.find((item) => item.id === eventId);
    const eventName = eventItem?.name ?? 'this event';
    const confirmed = await confirm({
      title: action === 'start' ? 'Start event' : 'Complete event',
      message:
        action === 'start'
          ? `Start "${eventName}"? This locks in the event for play.`
          : `Complete "${eventName}"? This cannot be undone.`,
      confirmLabel: action === 'start' ? 'Start' : 'Complete',
      variant: action === 'complete' ? 'destructive' : 'default',
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/events/${eventId}/${action}`, { method: 'POST' });
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

    const confirmed = await confirm({
      title: 'End season and start new',
      message: `End "${activeSeason.name}" and start "${nextSeasonName.trim()}" as the active season?`,
      confirmLabel: 'Start new season',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const created = await authApiRequest<ApiItemResponse<Season>>(`/api/leagues/${selectedLeagueSlug}/seasons`, {
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
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/seasons/${created.data.number}`, {
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
    const setCode = boosterForm.seedSet[0];
    if (!setCode) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const response = await authApiRequest<{ data: Record<string, string[]> }>(`/api/mtgjson/${setCode}/boosters`);
      const directMatch = response.data[boosterForm.boosterType];
      const fallback = response.data.default;
      const nextSetCodes = directMatch ?? fallback ?? [];
      if (nextSetCodes.length === 0) {
        setSuccess('No mapping found. Select set codes manually.');
        return;
      }
      const seed = setCode.trim().toUpperCase();
      const seedMissing = !nextSetCodes.some((code) => code.toUpperCase() === seed);
      setBoosterForm((prev) => ({
        ...prev,
        setCodes: nextSetCodes,
      }));
      setSuccess(
        seedMissing
          ? 'Set codes auto-detected from MTGJSON. Seed set was not in the detected list — set primary via Edit after save.'
          : 'Set codes auto-detected from MTGJSON.',
      );
    } catch (detectError) {
      setError(detectError instanceof ApiError ? detectError.message : 'Unable to auto-detect set codes');
    }
  };

  const createBoosterProduct = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const primarySetCode = resolveCreatePrimarySetCode(boosterForm.seedSet, boosterForm.setCodes);
      await authApiRequest('/api/booster-products', {
        method: 'POST',
        body: {
          name: boosterForm.name,
          setReleaseName: boosterForm.setReleaseName,
          boosterType: boosterForm.boosterType,
          setCodes: boosterForm.setCodes,
          ...(primarySetCode ? { primarySetCode } : {}),
        },
      });
      setBoosterForm({
        name: '',
        setReleaseName: '',
        boosterType: 'play',
        seedSet: [],
        setCodes: [],
      });
      setIsBoosterFormOpen(false);
      await loadBoosterProducts();
      setSuccess('Booster product saved.');
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : 'Unable to save booster product');
    }
  };

  const startEditBooster = (product: BoosterProduct) => {
    setEditingBoosterId(product.id);
    setEditBoosterForm({
      name: product.name,
      setReleaseName: product.setReleaseName,
      boosterType: product.boosterType,
      primarySet: product.primarySetCode ? [product.primarySetCode] : [],
      setCodes: product.setCodes.map((entry) => entry.setCode),
    });
  };

  const cancelEditBooster = () => {
    setEditingBoosterId(null);
  };

  const saveEditBooster = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingBoosterId) {
      return;
    }

    const editingProduct = boosterProducts.find((product) => product.id === editingBoosterId);
    const originalSetCodes = editingProduct?.setCodes.map((entry) => entry.setCode) ?? [];
    if (hasRemovedSetCodes(originalSetCodes, editBoosterForm.setCodes)) {
      const confirmed = await confirm({
        title: 'Remove booster sets',
        message: `Save "${editBoosterForm.name}" with fewer set codes? Removed sets will no longer be included in this product.`,
        confirmLabel: 'Save changes',
        variant: 'destructive',
      });
      if (!confirmed) {
        return;
      }
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/booster-products/${editingBoosterId}`, {
        method: 'PATCH',
        body: {
          name: editBoosterForm.name,
          setReleaseName: editBoosterForm.setReleaseName,
          boosterType: editBoosterForm.boosterType,
          setCodes: editBoosterForm.setCodes,
          ...(editBoosterForm.primarySet[0] ? { primarySetCode: editBoosterForm.primarySet[0] } : {}),
        },
      });
      setEditingBoosterId(null);
      await loadBoosterProducts();
      setSuccess('Booster product updated.');
    } catch (updateError) {
      setError(updateError instanceof ApiError ? updateError.message : 'Unable to update booster product');
    }
  };

  const deleteBoosterProduct = async (id: string) => {
    const product = boosterProducts.find((entry) => entry.id === id);
    const confirmed = await confirm({
      title: 'Delete booster product',
      message: `Delete "${product?.name ?? 'this booster product'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/booster-products/${id}`, { method: 'DELETE' });
      await loadBoosterProducts();
      setSuccess('Booster product deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : 'Unable to delete booster product');
    }
  };

  const removeLeagueMember = async (member: Member) => {
    if (!selectedLeagueSlug) {
      return;
    }

    const confirmed = await confirm({
      title: 'Remove league member',
      message: `Remove ${member.user.displayName} from the league? Their card pool (if any) will also be deleted.`,
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/members/${encodeURIComponent(membershipRowUserId(member))}`, {
        method: 'DELETE',
      });
      await loadMembers(selectedLeagueSlug);
      if (activeSeason) {
        await loadCardPools(selectedLeagueSlug, activeSeason.number);
      }
      setSuccess('Member removed.');
    } catch (memberError) {
      setError(formatMutationError(memberError, 'Unable to remove member'));
    }
  };

  const assignPool = async (userId: string) => {
    if (!selectedLeagueSlug || !activeSeason) {
      return;
    }

    const boosterProductId = poolAssignments[userId];
    if (!boosterProductId) {
      setError('Select a booster product before assigning a pool.');
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/seasons/${activeSeason.number}/pools`, {
        method: 'POST',
        body: { userId, boosterProductId },
      });
      await loadMembers(selectedLeagueSlug);
      await loadCardPools(selectedLeagueSlug, activeSeason.number);
      setSuccess('Pool assigned.');
    } catch (assignError) {
      setError(formatMutationError(assignError, 'Unable to assign pool'));
    }
  };

  const changePool = async (poolId: string, userId: string) => {
    if (!selectedLeagueSlug || !activeSeason) {
      return;
    }

    const boosterProductId = poolAssignments[userId];
    if (!boosterProductId) {
      setError('Select a booster product before updating the pool.');
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/seasons/${activeSeason.number}/pools/${poolId}`, {
        method: 'PATCH',
        body: { boosterProductId },
      });
      await loadMembers(selectedLeagueSlug);
      await loadCardPools(selectedLeagueSlug, activeSeason.number);
      setSuccess('Pool updated.');
    } catch (updateError) {
      setError(formatMutationError(updateError, 'Unable to update pool'));
    }
  };

  const removePool = async (poolId: string) => {
    if (!selectedLeagueSlug || !activeSeason) {
      return;
    }

    const confirmed = await confirm({
      title: 'Remove pool assignment',
      message: 'Remove this pool assignment?',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/leagues/${selectedLeagueSlug}/seasons/${activeSeason.number}/pools/${poolId}`, {
        method: 'DELETE',
      });
      await loadMembers(selectedLeagueSlug);
      await loadCardPools(selectedLeagueSlug, activeSeason.number);
      setSuccess('Pool removed.');
    } catch (deleteError) {
      setError(formatMutationError(deleteError, 'Unable to remove pool'));
    }
  };

  const siteAdminCount = useMemo(() => siteUsers.filter((u) => u.role === 'admin').length, [siteUsers]);
  const filteredSiteUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = q
      ? siteUsers.filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.slug.toLowerCase().includes(q) ||
            (u.publicName?.toLowerCase().includes(q) ?? false),
        )
      : siteUsers;
    return [...list].sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return 0;
    });
  }, [siteUsers, userSearch]);

  const toggleSiteRole = async (targetUser: SiteUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';

    if (targetUser.role === 'admin' && siteAdminCount <= 1) {
      setError('Cannot demote the last site admin.');
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await authApiRequest(`/api/users/${targetUser.id}/role`, {
        method: 'PATCH',
        body: { role: newRole },
      });
      await loadSiteUsers();
      setSuccess(`${targetUser.displayName} is now ${newRole === 'admin' ? 'an admin' : 'a regular user'}.`);
    } catch (toggleError) {
      setError(formatMutationError(toggleError, 'Unable to update user role'));
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {!user ? 'You must be signed in to access admin tools.' : 'You do not have admin access.'}
        </p>
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
            ['site-settings', 'Site Settings'],
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
                  <div className="flex items-start gap-2">
                    <p className="flex-1 font-mono text-xs break-all">{buildInviteJoinUrl(invite.token)}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void copyInviteLink(invite.token)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        aria-label="Copy invite link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                      {invite.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => revokeInviteLink(invite.id)}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {invite.status} • Uses {invite.useCount}
                    {invite.maxUses ? `/${invite.maxUses}` : ''} •{' '}
                    {invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleString()}` : 'No expiry'}
                  </p>
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
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  No league exists yet. Open the <strong>League Settings</strong> tab, enter a league name, and
                  click <strong>Save League Settings</strong> first.
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
                <h3 className="text-lg font-semibold">Members & Pools</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Update Role / Assign / Update here — these actions save immediately and are separate from Save Season
                  Settings above.
                </p>
                {boosterProducts.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Create a booster product first to assign pools.</p>
                ) : null}
                <div className="mt-4 space-y-3">
                  {members.map((member) => {
                    const uid = membershipRowUserId(member);
                    const pool = poolsByUserId.get(uid);
                    const name = primaryName(member.user);
                    const sub = profileSubtitle(member.user);
                    const initials = name
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <div key={member.id} className="rounded-md border border-border p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            {member.user.avatarUrl ? (
                              <img
                                src={member.user.avatarUrl}
                                alt={name}
                                className="h-10 w-10 rounded-full border border-border object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-xs font-semibold">
                                {initials || '?'}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{name}</p>
                              {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded bg-accent px-2 py-1 text-xs text-accent-foreground">
                              {pool ? pool.boosterProduct.name : 'No pool'}
                              {pool ? (
                                <SetSymbolGroup
                                  setCodes={
                                    boosterProducts.find((product) => product.id === pool.boosterProductId)?.setCodes.map(
                                      (entry) => entry.setCode,
                                    ) ?? []
                                  }
                                  primarySetCode={
                                    boosterProducts.find((product) => product.id === pool.boosterProductId)?.primarySetCode
                                  }
                                  getSet={getSet}
                                  primaryOnly
                                />
                              ) : null}
                            </span>

                            <select
                              className="rounded-md border border-border bg-background px-3 py-1 text-sm"
                              value={poolAssignments[uid] ?? pool?.boosterProductId ?? ''}
                              onChange={(event) =>
                                setPoolAssignments((prev) => ({
                                  ...prev,
                                  [uid]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select booster product</option>
                              {sortedBoosterProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>

                            {!pool ? (
                              <button
                                type="button"
                                className="rounded-md border border-border px-3 py-1 text-sm"
                                onClick={() => assignPool(uid)}
                                disabled={!poolAssignments[uid]}
                              >
                                Assign
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="rounded-md border border-border px-3 py-1 text-sm"
                                  onClick={() => changePool(pool.id, uid)}
                                  disabled={!poolAssignments[uid]}
                                >
                                  Update
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-border px-3 py-1 text-sm"
                                  onClick={() => removePool(pool.id)}
                                >
                                  Remove Pool
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              className="rounded-md border border-border px-3 py-1 text-sm"
                              onClick={() => removeLeagueMember(member)}
                            >
                              Remove Member
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {members.length === 0 ? <p className="text-sm text-muted-foreground">No league members yet.</p> : null}
                </div>
              </div>

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

                <form className="mb-4 grid gap-3 rounded-md border border-border p-3 md:grid-cols-5" onSubmit={createRoundRobinSeries}>
                  <div className="md:col-span-5">
                    <p className="text-sm font-medium">Auto-generate Long Round Robin</p>
                    <p className="text-xs text-muted-foreground">
                      Creates events in advance so the whole set collectively covers the paired rounds, based on rounds per
                      event. Any leftover slots are filled with random pairings.
                    </p>
                  </div>
                  <label className="text-sm font-medium md:col-span-2">
                    Base Event Name
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={roundRobinSeriesForm.baseName}
                      onChange={(event) =>
                        setRoundRobinSeriesForm((prev) => ({
                          ...prev,
                          baseName: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Rounds Per Event
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={roundRobinSeriesForm.roundsPerEvent}
                      onChange={(event) =>
                        setRoundRobinSeriesForm((prev) => ({
                          ...prev,
                          roundsPerEvent: Number(event.target.value),
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Point Multiplier
                    <input
                      type="number"
                      min={0.1}
                      step="0.1"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={roundRobinSeriesForm.pointMultiplier}
                      onChange={(event) =>
                        setRoundRobinSeriesForm((prev) => ({
                          ...prev,
                          pointMultiplier: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium"
                    >
                      Generate Series
                    </button>
                  </div>
                </form>

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
                        <option value="single_elimination">Single Elimination</option>
                        <option value="double_elimination">Double Elimination</option>
                        <option value="custom_10_player">Custom 10 Player</option>
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
                      <select
                        data-testid="min-deck-size-select"
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={eventForm.config.minDeckSize}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, minDeckSize: Number(event.target.value) },
                          }))
                        }
                      >
                        {minDeckSizeSelectOptions(eventForm.config.minDeckSize).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
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
                    {!isBracketFormat(eventForm.config.format) ? (
                      <>
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
                      </>
                    ) : null}
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
                        <option value="current_season">Current Season Standings</option>
                        <option value="previous_season">Prior Season Standings</option>
                        <option value="previous_event">Previous Event in This Season</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    {['double_elimination', 'custom_10_player'].includes(eventForm.config.format) ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(eventForm.config.grandFinalsReset)}
                          onChange={(event) =>
                            setEventForm((prev) => ({
                              ...prev,
                              config: { ...prev.config, grandFinalsReset: event.target.checked },
                            }))
                          }
                        />
                        Grand Finals Reset
                      </label>
                    ) : null}
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
                  {events.map((item) => {
                    const hasPendingRounds = (item.rounds ?? []).some((round) => round.status !== 'completed');
                    const isEditingThisEvent = editingEventId === item.id;
                    return (
                    <div key={item.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.status} • {item.config?.format ?? 'unknown'} • Bo{item.config?.bestOfN ?? '-'} • x
                            {item.pointMultiplier}
                          </p>
                          {item.status === 'active' && hasPendingRounds ? (
                            <p className="text-xs text-muted-foreground">Complete all event rounds before completing this event.</p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Link to={`/events/${item.id}`} className="rounded-md border border-border px-3 py-1 text-sm">
                            Manage
                          </Link>
                          {item.status === 'setup' ? (
                            <button
                              type="button"
                              onClick={() => (isEditingThisEvent ? cancelEditEvent() : startEditEvent(item))}
                              className="rounded-md border border-border px-3 py-1 text-sm"
                            >
                              {isEditingThisEvent ? 'Cancel Edit' : 'Edit'}
                            </button>
                          ) : null}
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
                              disabled={hasPendingRounds}
                              title={hasPendingRounds ? 'Complete all rounds first' : undefined}
                              className="rounded-md border border-border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Complete
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {isEditingThisEvent ? (
                        <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={saveEditEvent}>
                          <label className="text-sm font-medium">
                            Event Name
                            <input
                              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editEventForm.name}
                              onChange={(event) => setEditEventForm((prev) => ({ ...prev, name: event.target.value }))}
                              required
                            />
                          </label>
                          <label className="text-sm font-medium">
                            Format
                            <select
                              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editEventForm.config.format}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
                                  ...prev,
                                  config: { ...prev.config, format: event.target.value as EventConfig['format'] },
                                }))
                              }
                            >
                              <option value="swiss">Swiss</option>
                              <option value="seeded_swiss">Seeded Swiss</option>
                              <option value="round_robin">Round Robin</option>
                              <option value="single_elimination">Single Elimination</option>
                              <option value="double_elimination">Double Elimination</option>
                              <option value="custom_10_player">Custom 10 Player</option>
                            </select>
                          </label>
                          <label className="text-sm font-medium">
                            Best Of
                            <input
                              type="number"
                              min={1}
                              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editEventForm.config.bestOfN}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
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
                              value={editEventForm.config.deckCount}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
                                  ...prev,
                                  config: { ...prev.config, deckCount: Number(event.target.value) },
                                }))
                              }
                            />
                          </label>
                          <label className="text-sm font-medium">
                            Min Deck Size
                            <select
                              data-testid="min-deck-size-select"
                              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editEventForm.config.minDeckSize}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
                                  ...prev,
                                  config: { ...prev.config, minDeckSize: Number(event.target.value) },
                                }))
                              }
                            >
                              {minDeckSizeSelectOptions(editEventForm.config.minDeckSize).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm font-medium">
                            Point Multiplier
                            <input
                              type="number"
                              min={0.1}
                              step="0.1"
                              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editEventForm.pointMultiplier}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
                                  ...prev,
                                  pointMultiplier: Number(event.target.value),
                                }))
                              }
                            />
                          </label>
                          <label className="text-sm font-medium">
                            Sideboard Rule
                            <select
                              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editEventForm.config.sideboardRule}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
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
                          {!isBracketFormat(editEventForm.config.format) ? (
                            <>
                              <label className="text-sm font-medium">
                                Scheduling Type
                                <select
                                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                  value={editEventForm.config.schedulingType}
                                  onChange={(event) =>
                                    setEditEventForm((prev) => ({
                                      ...prev,
                                      config: { ...prev.config, schedulingType: event.target.value as EventConfig['schedulingType'] },
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
                                  value={editEventForm.config.deckLockingMode}
                                  onChange={(event) =>
                                    setEditEventForm((prev) => ({
                                      ...prev,
                                      config: { ...prev.config, deckLockingMode: event.target.value as EventConfig['deckLockingMode'] },
                                    }))
                                  }
                                >
                                  <option value="required_before_round">Required Before Round</option>
                                  <option value="free_modification">Free Modification</option>
                                  <option value="admin_locked">Admin Locked</option>
                                </select>
                              </label>
                            </>
                          ) : null}
                          <label className="text-sm font-medium">
                            Seeding Source
                            <select
                              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editEventForm.config.seedingSource ?? ''}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
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
                          {['double_elimination', 'custom_10_player'].includes(editEventForm.config.format) ? (
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(editEventForm.config.grandFinalsReset)}
                                onChange={(event) =>
                                  setEditEventForm((prev) => ({
                                    ...prev,
                                    config: { ...prev.config, grandFinalsReset: event.target.checked },
                                  }))
                                }
                              />
                              Grand Finals Reset
                            </label>
                          ) : null}
                          <label className="flex items-center gap-2 text-sm md:col-span-3">
                            <input
                              type="checkbox"
                              checked={editEventForm.standingsOverride}
                              onChange={(event) =>
                                setEditEventForm((prev) => ({
                                  ...prev,
                                  standingsOverride: event.target.checked,
                                }))
                              }
                            />
                            Standings Override
                          </label>
                          <div className="md:col-span-3">
                            <button
                              type="submit"
                              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              Save Settings
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                    );
                  })}
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
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="clear-reimport-all-sets"
                onClick={clearAndImportAllBoosterSets}
                disabled={allBoosterSetCodes.length === 0 || clearingAllSets}
                className="rounded-md border border-border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearingAllSets ? 'Clearing & re-importing all sets…' : 'Clear & re-import all sets'}
              </button>
              <button
                type="button"
                onClick={() => setIsBoosterFormOpen((prev) => !prev)}
                className="rounded-md border border-border px-3 py-1 text-sm"
              >
                {isBoosterFormOpen ? 'Cancel' : 'Add Booster'}
              </button>
            </div>
          </div>

          {isBoosterFormOpen ? (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={createBoosterProduct}>
              <div className="md:col-span-2">
                <SetCodePicker
                  label="Seed Set (for auto-detect)"
                  multiple={false}
                  value={boosterForm.seedSet}
                  onChange={(codes) => {
                    const singleCode = codes[0] ? [codes[0]] : [];
                    setBoosterForm((prev) => ({ ...prev, seedSet: singleCode }));
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This set is also used as the display icon when it is included in the product&apos;s set codes.
                </p>
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
                  disabled={!boosterForm.seedSet[0]}
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

          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Search booster products by name, set, or code…"
            value={boosterProductSearch}
            onChange={(event) => setBoosterProductSearch(event.target.value)}
          />

          <div className="space-y-3">
            {filteredBoosterProducts.map((product) => (
              <div key={product.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.setReleaseName} • {product.boosterType}
                    </p>
                    <BoosterProductSetBadges product={product} getSet={getSet} />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEditBooster(product)}
                      className="rounded-md border border-border px-3 py-1 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBoosterProduct(product.id)}
                      className="rounded-md border border-border px-3 py-1 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <BoosterProductCacheControls
                  product={product}
                  cacheStats={cacheStatsBySetCode}
                  importingSetCode={importingSetCode}
                  importingProductId={importingProductId}
                  clearingSetCode={clearingSetCode}
                  clearingProductId={clearingProductId}
                  clearingAllSets={clearingAllSets}
                  onImportSet={importSetToCache}
                  onImportProduct={importBoosterProductToCache}
                  onClearAndImportSet={clearAndImportSetToCache}
                  onClearAndImportProduct={clearAndImportBoosterProductToCache}
                  getSet={getSet}
                />

                {editingBoosterId === product.id ? (
                  <form className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2" onSubmit={saveEditBooster}>
                    <div className="md:col-span-2">
                      <SetCodePicker
                        label="Primary Set"
                        multiple={false}
                        value={editBoosterForm.primarySet}
                        onChange={(codes) => {
                          const singleCode = codes[0] ? [codes[0]] : [];
                          setEditBoosterForm((prev) => ({ ...prev, primarySet: singleCode }));
                        }}
                      />
                    </div>
                    <label className="text-sm font-medium">
                      Product Name
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={editBoosterForm.name}
                        onChange={(event) =>
                          setEditBoosterForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Set Release Name
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={editBoosterForm.setReleaseName}
                        onChange={(event) =>
                          setEditBoosterForm((prev) => ({ ...prev, setReleaseName: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Booster Type
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={editBoosterForm.boosterType}
                        onChange={(event) =>
                          setEditBoosterForm((prev) => ({
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
                    <div className="md:col-span-2">
                      <SetCodePicker
                        label="Set Codes"
                        value={editBoosterForm.setCodes}
                        onChange={(codes) => setEditBoosterForm((prev) => ({ ...prev, setCodes: codes }))}
                      />
                    </div>
                    <div className="flex gap-2 md:col-span-2">
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditBooster}
                        className="rounded-md border border-border px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ))}
            {boosterProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No booster products configured.</p>
            ) : filteredBoosterProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No booster products match your search.</p>
            ) : null}
          </div>
        </Tabs.Content>

        <Tabs.Content value="site-settings" className="space-y-6 rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">Site Users</h3>
          <p className="text-xs text-muted-foreground">
            Manage user roles. Site admins can manage all leagues, seasons, members, and booster products.
          </p>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Search users by name…"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
          />
          <div className="space-y-3">
            {filteredSiteUsers.map((siteUser) => {
              const isLastAdmin = siteUser.role === 'admin' && siteAdminCount <= 1;
              const sName = primaryName(siteUser);
              const sSub = profileSubtitle(siteUser);
              const initials = sName
                .split(/\s+/)
                .filter(Boolean)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div key={siteUser.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {siteUser.avatarUrl ? (
                        <img
                          src={siteUser.avatarUrl}
                          alt={sName}
                          className="h-10 w-10 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-xs font-semibold">
                          {initials || '?'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{sName}</p>
                        {sSub ? (
                          <p className="text-xs text-muted-foreground">{sSub}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(siteUser.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${siteUser.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}
                      >
                        {siteUser.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                      <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1 text-sm"
                        onClick={() => toggleSiteRole(siteUser)}
                        disabled={isLastAdmin}
                        title={isLastAdmin ? 'Cannot demote the last admin' : undefined}
                      >
                        {siteUser.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredSiteUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {userSearch.trim() ? 'No users match your search.' : 'No users found.'}
              </p>
            ) : null}
          </div>
        </Tabs.Content>
      </Tabs.Root>
      {staleDialogReferences.length > 0 ? (
        <StaleCacheReferencesDialog
          deletedCards={staleDialogDeletedCards}
          staleReferences={staleDialogReferences}
          resolving={resolvingStaleReferences}
          onResolve={resolveStaleDialogActions}
          onDismiss={() => {
            setStaleDialogDeletedCards([]);
            setStaleDialogReferences([]);
          }}
        />
      ) : null}
    </div>
  );
}
