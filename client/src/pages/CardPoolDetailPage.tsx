import { FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiRequest, getStoredToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { primaryName, secondaryName } from '@/lib/userDisplay';
import { CardHoverPreview } from '@/components/cardpool/CardHoverPreview';
import { CardPreviewProvider } from '@/components/cardpool/CardPreviewContext';
import { CurveView } from '@/components/cardpool/CurveView';
import { GridView } from '@/components/cardpool/GridView';
import { ListView } from '@/components/cardpool/ListView';
import { ManaCostSymbols } from '@/components/cardpool/ManaCostSymbols';
import { StacksView } from '@/components/cardpool/StacksView';
import { StagedChangeRow } from '@/components/cardpool/StagedChangeRow';
import { StagedOwnerCardRow } from '@/components/cardpool/StagedOwnerCardRow';
import { ViewToolbar } from '@/components/cardpool/ViewToolbar';
import { SetSymbol } from '@/components/SetSymbol';
import { SetSymbolGroup } from '@/components/SetSymbolGroup';
import { useScryfallSets } from '@/hooks/useScryfallSets';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy, ViewMode } from '@/components/cardpool/types';
import { CARD_TYPE_FILTERS, COLOR_FILTERS, filterPoolCards } from '@/lib/cardPoolFilters';
import { focusAndSelectInput } from '@/lib/focusSearchInputAfterStage';
import { flattenEntries, getImageUrl, sortCards } from '@/lib/cardPoolSort';

type PoolDetail = {
  id: string;
  user: {
    id: string;
    displayName: string;
    publicName?: string | null;
    slug: string;
    avatarUrl: string | null;
  };
  boosterProduct: {
    id: string;
    name: string;
    boosterType: 'draft' | 'play' | 'set' | 'collector';
    setCodes: Array<{
      id: string;
      setCode: string;
    }>;
  };
  season: {
    id: string;
    name: string;
    number: number;
    league: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

type CachedCardSummary = {
  scryfallId: string;
  name: string;
  setCode: string;
  imageUris: unknown;
  manaCost: string | null;
  typeLine: string;
  rarity: string;
  cmc: number;
  colors: string[];
  colorIdentity: string[];
};

type AcquisitionEntry = {
  id: string;
  cachedCardId: string;
  quantity: number;
  cachedCard: CachedCardSummary;
};

type PoolAcquisition = {
  id: string;
  phaseLabel: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  entries: AcquisitionEntry[];
};

type PoolResponse = {
  data: {
    pool: PoolDetail;
    acquisitions: PoolAcquisition[];
  };
};

type SearchResult = {
  scryfallId: string;
  name: string;
  setCode: string;
  imageUris: unknown;
  manaCost: string | null;
  typeLine: string;
};

type SearchResponse = {
  data: SearchResult[];
};

type CreateAcquisitionResponse = {
  data: PoolAcquisition;
};

type BulkResponse = {
  data: {
    acquisition: PoolAcquisition | null;
    unresolved: string[];
  };
};

type AdjustCardAction = 'add' | 'remove_one' | 'remove_all';
type StagedPoolChange = {
  id: string;
  cachedCardId: string;
  cardName: string;
  phaseLabel: string;
  action: AdjustCardAction;
  quantity: number;
  imageUri: string | null;
};

type SeasonEvent = {
  id: string;
};

type SeasonEventsResponse = {
  data: SeasonEvent[];
};

type StagedCard = {
  cachedCardId: string;
  name: string;
  setCode: string;
  manaCost: string | null;
  imageUri: string | null;
  quantity: number;
  phaseLabel: string;
};

type AdminContextMenuState = {
  pageX: number;
  pageY: number;
  card: PoolCard;
  phaseLabel: string;
};

function getSmallImage(imageUris: unknown): string | null {
  if (!imageUris || typeof imageUris !== 'object') {
    return null;
  }
  const maybeSmall = (imageUris as Record<string, unknown>).small;
  return typeof maybeSmall === 'string' ? maybeSmall : null;
}

const VIEW_PREFERENCES_KEY = 'cardpool-view-prefs';
const VISUAL_VIEW_MAX_CARDS = 180;
const STACK_CARD_WIDTH_DEFAULT = 220;
const STACKS_ORGANIZE_DEFAULT: StacksOrganizeBy = 'type';
function parseViewPreferences(rawValue: string | null): { viewMode: ViewMode; sortKey: SortKey; groupMode: GroupMode } {
  if (!rawValue) {
    return { viewMode: 'list', sortKey: 'type', groupMode: 'flat' };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<{ viewMode: ViewMode; sortKey: SortKey; groupMode: GroupMode }>;
    return {
      viewMode: parsed.viewMode ?? 'list',
      sortKey: parsed.sortKey ?? 'type',
      groupMode: parsed.groupMode ?? 'flat',
    };
  } catch {
    return { viewMode: 'list', sortKey: 'type', groupMode: 'flat' };
  }
}

function parseBulkItems(input: string) {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const match = line.match(/^(\d+)?\s*(.+)$/);
      if (!match) {
        return null;
      }
      const quantity = match[1] ? Number(match[1]) : 1;
      const name = match[2].trim();
      if (!name || !Number.isInteger(quantity) || quantity < 1) {
        return null;
      }
      return { name, quantity };
    })
    .filter((item): item is { name: string; quantity: number } => item !== null);
}

function parseFileNameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return null;
  }
  const match = disposition.match(/filename="?(?<filename>[^"]+)"?/i);
  return match?.groups?.filename ?? null;
}

export function CardPoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const { getSet } = useScryfallSets();
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [acquisitions, setAcquisitions] = useState<PoolAcquisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [phaseLabel, setPhaseLabel] = useState('Initial Pool');
  const [seasonEvents, setSeasonEvents] = useState<SeasonEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [stagedCards, setStagedCards] = useState<StagedCard[]>([]);

  const [bulkText, setBulkText] = useState('');
  const [bulkPhaseLabel, setBulkPhaseLabel] = useState('Initial Pool');
  const [bulkUnresolved, setBulkUnresolved] = useState<string[]>([]);
  const [bulkAddedCount, setBulkAddedCount] = useState(0);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [clearPhaseLabel, setClearPhaseLabel] = useState('Initial Pool');
  const [clearingPhase, setClearingPhase] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortKey, setSortKey] = useState<SortKey>('type');
  const [groupMode, setGroupMode] = useState<GroupMode>('flat');
  const [stackCardWidth, setStackCardWidth] = useState(STACK_CARD_WIDTH_DEFAULT);
  const [stacksOrganizeBy, setStacksOrganizeBy] = useState<StacksOrganizeBy>(STACKS_ORGANIZE_DEFAULT);
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<string[]>([...CARD_TYPE_FILTERS]);
  const [selectedColorFilters, setSelectedColorFilters] = useState<string[]>([...COLOR_FILTERS]);
  const [showBasicLands, setShowBasicLands] = useState(false);
  const [adminContextMenu, setAdminContextMenu] = useState<AdminContextMenuState | null>(null);
  const [stagedPoolChanges, setStagedPoolChanges] = useState<StagedPoolChange[]>([]);
  const [applyingStagedChanges, setApplyingStagedChanges] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadPool = async () => {
    if (!poolId) {
      setError('Missing pool id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<PoolResponse>(`/api/card-pools/${poolId}`);
      setPool(response.data.pool);
      setAcquisitions(response.data.acquisitions);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load card pool');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  const isOwner = Boolean(user && pool && user.id === pool.user.id);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const loadSeasonEvents = async () => {
      if (!pool?.season.id) {
        setSeasonEvents([]);
        return;
      }

      try {
        const response = await apiRequest<SeasonEventsResponse>(`/api/seasons/${pool.season.id}/events`);
        setSeasonEvents(response.data);
      } catch {
        setSeasonEvents([]);
      }
    };

    void loadSeasonEvents();
  }, [pool?.season.id]);

  const phaseOptions = useMemo(() => {
    const options = ['Initial Pool'];
    for (let round = 1; round <= seasonEvents.length; round += 1) {
      options.push(`After Round ${round}`);
    }
    return options;
  }, [seasonEvents.length]);

  const availablePhaseOptions = useMemo(() => {
    const ordered = [...phaseOptions];
    for (const acquisition of acquisitions) {
      if (!ordered.includes(acquisition.phaseLabel)) {
        ordered.push(acquisition.phaseLabel);
      }
    }
    return ordered;
  }, [acquisitions, phaseOptions]);

  useEffect(() => {
    if (!phaseOptions.includes(phaseLabel)) {
      setPhaseLabel(phaseOptions[0]);
    }
  }, [phaseLabel, phaseOptions]);

  useEffect(() => {
    if (!phaseOptions.includes(bulkPhaseLabel)) {
      setBulkPhaseLabel(phaseOptions[0]);
    }
  }, [bulkPhaseLabel, phaseOptions]);

  useEffect(() => {
    if (!availablePhaseOptions.includes(clearPhaseLabel)) {
      setClearPhaseLabel(availablePhaseOptions[0] ?? 'Initial Pool');
    }
  }, [availablePhaseOptions, clearPhaseLabel]);

  useEffect(() => {
    if (!adminContextMenu) {
      return;
    }

    const closeMenu = () => {
      setAdminContextMenu(null);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', onEscape);
    };
  }, [adminContextMenu]);

  useEffect(() => {
    const stored = parseViewPreferences(window.localStorage.getItem(VIEW_PREFERENCES_KEY));
    setViewMode(stored.viewMode);
    setSortKey(stored.sortKey);
    setGroupMode(stored.groupMode);
    const storedStackWidth = window.localStorage.getItem('cardpool-stacks-width');
    if (storedStackWidth) {
      const parsed = Number(storedStackWidth);
      if (Number.isFinite(parsed)) {
        setStackCardWidth(Math.max(160, Math.min(280, parsed)));
      }
    }
    const storedStacksOrganize = window.localStorage.getItem('cardpool-stacks-organize');
    if (
      storedStacksOrganize === 'type' ||
      storedStacksOrganize === 'color' ||
      storedStacksOrganize === 'cmc' ||
      storedStacksOrganize === 'creature_split'
    ) {
      setStacksOrganizeBy(storedStacksOrganize);
    } else if (storedStacksOrganize === 'type_cmc') {
      // Backward compatibility with prior organize key.
      setStacksOrganizeBy('creature_split');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_PREFERENCES_KEY, JSON.stringify({ viewMode, sortKey, groupMode }));
  }, [groupMode, sortKey, viewMode]);

  useEffect(() => {
    window.localStorage.setItem('cardpool-stacks-width', String(stackCardWidth));
  }, [stackCardWidth]);

  useEffect(() => {
    window.localStorage.setItem('cardpool-stacks-organize', stacksOrganizeBy);
  }, [stacksOrganizeBy]);

  useEffect(() => {
    if (!pool) {
      setSearchResults([]);
      return;
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const sets = pool.boosterProduct.setCodes.map((setCode) => setCode.setCode).join(',');
        const response = await apiRequest<SearchResponse>(
          `/api/cards/search?q=${encodeURIComponent(trimmed)}&sets=${encodeURIComponent(sets)}`,
        );
        setSearchResults(response.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pool, searchQuery]);

  const totalCards = useMemo(
    () =>
      acquisitions.reduce(
        (sum, acquisition) =>
          sum + acquisition.entries.reduce((entrySum, entry) => entrySum + entry.quantity, 0),
        0,
      ),
    [acquisitions],
  );

  const poolCards = useMemo(() => flattenEntries(acquisitions, groupMode), [acquisitions, groupMode]);
  const sortedCards = useMemo(() => sortCards(poolCards, sortKey), [poolCards, sortKey]);
  const visibleCards = useMemo(
    () =>
      filterPoolCards(sortedCards, {
        selectedColorFilters,
        selectedTypeFilters,
        showBasicLands,
      }),
    [selectedColorFilters, selectedTypeFilters, showBasicLands, sortedCards],
  );
  const visibleCardCount = useMemo(
    () => visibleCards.reduce((sum, card) => sum + card.quantity, 0),
    [visibleCards],
  );
  const disableVisualViews = totalCards > VISUAL_VIEW_MAX_CARDS;

  useEffect(() => {
    if (disableVisualViews && viewMode !== 'list') {
      setViewMode('list');
    }
  }, [disableVisualViews, viewMode]);

  const addSearchResultToStage = (card: SearchResult) => {
    setSuccess(null);
    setError(null);
    setBulkUnresolved([]);
    setBulkAddedCount(0);

    const quantity = 1;
    const imageUri = getSmallImage(card.imageUris);
    const targetPhaseLabel = phaseLabel;
    setStagedCards((prev) => {
      const existingIndex = prev.findIndex(
        (entry) => entry.cachedCardId === card.scryfallId && entry.phaseLabel === targetPhaseLabel,
      );
      if (existingIndex === -1) {
        return [
          ...prev,
          {
            cachedCardId: card.scryfallId,
            name: card.name,
            setCode: card.setCode,
            manaCost: card.manaCost,
            imageUri,
            quantity,
            phaseLabel: targetPhaseLabel,
          },
        ];
      }

      const next = [...prev];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + 1,
      };
      return next;
    });
    focusAndSelectInput(searchInputRef.current);
  };

  const updateStagedQuantity = (cachedCardId: string, phase: string, quantity: number) => {
    setStagedCards((prev) =>
      prev.map((entry) =>
        entry.cachedCardId === cachedCardId && entry.phaseLabel === phase ? { ...entry, quantity } : entry,
      ),
    );
  };

  const removeStagedCard = (cachedCardId: string, phase: string) => {
    setStagedCards((prev) =>
      prev.filter((entry) => !(entry.cachedCardId === cachedCardId && entry.phaseLabel === phase)),
    );
  };

  const bulkAddCards = async (event: FormEvent) => {
    event.preventDefault();
    if (!poolId) {
      return;
    }

    const items = parseBulkItems(bulkText);
    if (items.length === 0) {
      setError('Enter at least one card name to bulk add.');
      return;
    }

    setBulkAdding(true);
    setError(null);
    setSuccess(null);
    setBulkUnresolved([]);
    setBulkAddedCount(0);

    try {
      const response = await apiRequest<BulkResponse>(`/api/card-pools/${poolId}/acquisitions/bulk`, {
        method: 'POST',
        body: {
          phaseLabel: bulkPhaseLabel,
          items,
        },
      });

      const addedCount =
        response.data.acquisition?.entries.reduce((sum, entry) => sum + entry.quantity, 0) ?? 0;
      setBulkAddedCount(addedCount);
      setBulkUnresolved(response.data.unresolved);
      setSuccess(addedCount > 0 ? `Bulk added ${addedCount} cards.` : 'No cards were added.');
      setBulkText('');
      setIsBulkAddOpen(false);
      await loadPool();
    } catch (bulkAddError) {
      setError(bulkAddError instanceof ApiError ? bulkAddError.message : 'Unable to bulk add cards');
    } finally {
      setBulkAdding(false);
    }
  };

  const exportPool = async () => {
    if (!poolId) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const token = getStoredToken();
      const response = await fetch(`/api/card-pools/${poolId}/export/decklist`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Unable to export pool');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const fileName = parseFileNameFromDisposition(disposition) ?? 'pool.txt';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setSuccess('Pool exported.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export pool');
    }
  };

  const clearPhase = async () => {
    if (!poolId || !isAdmin) {
      return;
    }

    const confirmed = window.confirm(
      `Clear all cards in "${clearPhaseLabel}" for this pool? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setClearingPhase(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/card-pools/${poolId}/phases`, {
        method: 'DELETE',
        body: {
          phaseLabel: clearPhaseLabel,
        },
      });
      await loadPool();
      setSuccess(`Cleared phase "${clearPhaseLabel}".`);
    } catch (clearError) {
      setError(clearError instanceof ApiError ? clearError.message : 'Unable to clear phase');
    } finally {
      setClearingPhase(false);
    }
  };

  const handleAdminCardContextMenu = (event: MouseEvent, card: PoolCard) => {
    if (!isAdmin) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const matchingPhases = Object.keys(card.phaseQuantities);
    const defaultPhase = matchingPhases[0] ?? card.phaseLabel ?? availablePhaseOptions[0] ?? 'Initial Pool';
    setAdminContextMenu({
      pageX: event.pageX,
      pageY: event.pageY,
      card,
      phaseLabel: defaultPhase,
    });
  };

  const selectedPhaseQuantity = adminContextMenu
    ? (adminContextMenu.card.phaseQuantities[adminContextMenu.phaseLabel] ?? 0)
    : 0;
  const stagedRemovalForSelection = adminContextMenu
    ? stagedPoolChanges.find(
        (change) =>
          change.cachedCardId === adminContextMenu.card.scryfallId &&
          change.phaseLabel === adminContextMenu.phaseLabel &&
          change.action !== 'add',
      )
    : null;
  const stagedContextAddsForSelection = adminContextMenu
    ? stagedPoolChanges
        .filter(
          (change) =>
            change.cachedCardId === adminContextMenu.card.scryfallId &&
            change.phaseLabel === adminContextMenu.phaseLabel &&
            change.action === 'add',
        )
        .reduce((sum, change) => sum + change.quantity, 0)
    : 0;
  const stagedCardAddsForSelection = adminContextMenu
    ? stagedCards
        .filter(
          (card) =>
            card.cachedCardId === adminContextMenu.card.scryfallId && card.phaseLabel === adminContextMenu.phaseLabel,
        )
        .reduce((sum, card) => sum + card.quantity, 0)
    : 0;
  const totalAvailableForSelection = selectedPhaseQuantity + stagedContextAddsForSelection + stagedCardAddsForSelection;
  const stagedRemovalQuantityForSelection =
    stagedRemovalForSelection?.action === 'remove_one'
      ? stagedRemovalForSelection.quantity
      : stagedRemovalForSelection?.action === 'remove_all'
        ? totalAvailableForSelection
        : 0;
  const canStageAnotherSingleRemoval =
    totalAvailableForSelection > 0 &&
    (!stagedRemovalForSelection || stagedRemovalForSelection.action !== 'remove_all') &&
    stagedRemovalQuantityForSelection < totalAvailableForSelection;

  const stagePoolChange = (action: AdjustCardAction) => {
    if (!adminContextMenu) {
      return;
    }

    const stagedImageUri =
      getImageUrl(adminContextMenu.card, 'small') ?? getImageUrl(adminContextMenu.card, 'normal');

    if (action !== 'add') {
      const existingRemovalIndex = stagedPoolChanges.findIndex(
        (change) =>
          change.cachedCardId === adminContextMenu.card.scryfallId &&
          change.phaseLabel === adminContextMenu.phaseLabel &&
          change.action !== 'add',
      );

      if (action === 'remove_one' && !canStageAnotherSingleRemoval) {
        setError('Cannot stage more removals than available copies in this acquisition group.');
        setSuccess(null);
        setAdminContextMenu(null);
        return;
      }

      if (action === 'remove_all' && totalAvailableForSelection < 1) {
        setError('No copies are available to remove in this acquisition group.');
        setSuccess(null);
        setAdminContextMenu(null);
        return;
      }

      if (existingRemovalIndex >= 0) {
        setStagedPoolChanges((prev) => {
          const next = [...prev];
          const existing = next[existingRemovalIndex];
          if (action === 'remove_one' && existing.action === 'remove_one') {
            next[existingRemovalIndex] = {
              ...existing,
              quantity: existing.quantity + 1,
              imageUri: existing.imageUri ?? stagedImageUri,
            };
          } else {
            next[existingRemovalIndex] = {
              ...existing,
              action,
              quantity: 1,
              imageUri: existing.imageUri ?? stagedImageUri,
            };
          }
          return next;
        });
        setAdminContextMenu(null);
        setSuccess('Updated staged removal for this card.');
        setError(null);
        return;
      }
    }

    if (action === 'add') {
      const existingAddIndex = stagedPoolChanges.findIndex(
        (change) =>
          change.cachedCardId === adminContextMenu.card.scryfallId &&
          change.phaseLabel === adminContextMenu.phaseLabel &&
          change.action === 'add',
      );
      if (existingAddIndex >= 0) {
        setStagedPoolChanges((prev) => {
          const next = [...prev];
          const existing = next[existingAddIndex];
          next[existingAddIndex] = {
            ...existing,
            quantity: existing.quantity + 1,
            imageUri: existing.imageUri ?? stagedImageUri,
          };
          return next;
        });
        setAdminContextMenu(null);
        setSuccess('Updated staged add for this card.');
        setError(null);
        return;
      }
    }

    setStagedPoolChanges((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        cachedCardId: adminContextMenu.card.scryfallId,
        cardName: adminContextMenu.card.name,
        phaseLabel: adminContextMenu.phaseLabel,
        action,
        quantity: 1,
        imageUri: stagedImageUri,
      },
    ]);
    setAdminContextMenu(null);
    setSuccess(action === 'add' ? 'Add staged. Apply staged changes when ready.' : 'Removal staged. Apply staged changes when ready.');
    setError(null);
  };

  const removeStagedPoolChange = (id: string) => {
    setStagedPoolChanges((prev) => prev.filter((change) => change.id !== id));
  };

  const applyStagedPoolChanges = async () => {
    if (!poolId || (stagedPoolChanges.length === 0 && stagedCards.length === 0)) {
      return;
    }

    setApplyingStagedChanges(true);
    setError(null);
    setSuccess(null);
    try {
      const cardsByPhase = new Map<string, Array<{ cachedCardId: string; quantity: number }>>();
      for (const card of stagedCards) {
        const existing = cardsByPhase.get(card.phaseLabel) ?? [];
        existing.push({ cachedCardId: card.cachedCardId, quantity: card.quantity });
        cardsByPhase.set(card.phaseLabel, existing);
      }

      for (const [stagedPhaseLabel, cards] of cardsByPhase.entries()) {
        await apiRequest<CreateAcquisitionResponse>(`/api/card-pools/${poolId}/acquisitions`, {
          method: 'POST',
          body: {
            phaseLabel: stagedPhaseLabel,
            cards,
          },
        });
      }

      const stagedAddChanges = stagedPoolChanges.filter((change) => change.action === 'add');
      const stagedRemovalChanges = stagedPoolChanges.filter((change) => change.action !== 'add');
      const orderedChanges = [...stagedAddChanges, ...stagedRemovalChanges];

      for (const change of orderedChanges) {
        const repeatCount = change.action === 'remove_all' ? 1 : Math.max(1, change.quantity);
        for (let index = 0; index < repeatCount; index += 1) {
          await apiRequest(`/api/card-pools/${poolId}/cards/adjust`, {
            method: 'PATCH',
            body: {
              phaseLabel: change.phaseLabel,
              cachedCardId: change.cachedCardId,
              action: change.action,
            },
          });
        }
      }
      setStagedCards([]);
      setStagedPoolChanges([]);
      await loadPool();
      setSuccess('Staged changes applied.');
    } catch (applyError) {
      setError(applyError instanceof ApiError ? applyError.message : 'Unable to apply staged changes');
    } finally {
      setApplyingStagedChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading card pool...</p>
      </div>
    );
  }

  if (error && !pool) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Card Pool</h1>
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Card Pool</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pool not found.</p>
      </div>
    );
  }

  const ownerPrimary = primaryName(pool.user);
  const ownerSecondary = secondaryName(pool.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Card Pool</h1>
        <p className="mt-1 text-muted-foreground">
          {pool.season.league.name} - Season {pool.season.number}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Pool Owner</p>
            <p className="text-lg font-semibold">{ownerPrimary}</p>
            {ownerSecondary ? <p className="text-xs text-muted-foreground">{ownerSecondary}</p> : null}
          </div>
          <button
            type="button"
            onClick={exportPool}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Export Pool
          </button>
          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                setBulkUnresolved([]);
                setBulkAddedCount(0);
                setIsBulkAddOpen(true);
              }}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Bulk Add Cards
            </button>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Booster Product</p>
          <p className="font-medium">
            {pool.boosterProduct.name} ({pool.boosterProduct.boosterType})
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Sets:</span>
            {pool.boosterProduct.setCodes.length > 0 ? (
              <SetSymbolGroup
                setCodes={pool.boosterProduct.setCodes.map((entry) => entry.setCode)}
                getSet={getSet}
                maxVisible={6}
              />
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Cards</p>
          <p className="text-2xl font-bold">{totalCards}</p>
        </div>
        {isAdmin ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">Admin: Clear Entire Phase</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-w-52 rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={clearPhaseLabel}
                onChange={(event) => setClearPhaseLabel(event.target.value)}
                disabled={clearingPhase}
              >
                {availablePhaseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void clearPhase()}
                disabled={clearingPhase || availablePhaseOptions.length === 0}
                className="rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
              >
                {clearingPhase ? 'Clearing...' : 'Clear Phase'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isOwner ? (
        <>
          <form
            className="rounded-lg border border-border bg-card p-6 space-y-4"
            onSubmit={(event) => event.preventDefault()}
          >
            <h2 className="text-lg font-semibold">Add Cards</h2>

            <label className="block text-sm font-medium">
              Phase Label
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={phaseLabel}
                onChange={(event) => setPhaseLabel(event.target.value)}
              >
                {phaseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Search Cards
              <input
                ref={searchInputRef}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by card name..."
              />
            </label>

            {searching ? <p className="text-xs text-muted-foreground">Searching...</p> : null}
            {!searching && searchResults.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {searchResults.map((card) => (
                  <button
                    type="button"
                    key={card.scryfallId}
                    className="flex w-full items-center justify-between gap-3 rounded border border-border p-2 text-left hover:bg-muted"
                    onClick={() => addSearchResultToStage(card)}
                  >
                    <div className="flex items-center gap-3">
                      {getSmallImage(card.imageUris) ? (
                        <img
                          src={getSmallImage(card.imageUris) ?? undefined}
                          alt={card.name}
                          className="h-10 w-8 rounded border border-border object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="text-sm font-medium">{card.name}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <SetSymbol
                            setCode={card.setCode}
                            size="sm"
                            iconUri={getSet(card.setCode)?.icon_svg_uri}
                            setName={getSet(card.setCode)?.name}
                          />
                          <ManaCostSymbols manaCost={card.manaCost} className="inline-flex align-middle" />
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">Add</span>
                  </button>
                ))}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Selected cards are staged below. Review staged changes, then apply when ready.
            </p>
          </form>
        </>
      ) : null}

      {isOwner || isAdmin ? (
        <div className="rounded-md border border-border/70 bg-card px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Staged Changes</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                onClick={() => {
                  setStagedCards([]);
                  setStagedPoolChanges([]);
                }}
                disabled={applyingStagedChanges || (stagedCards.length === 0 && stagedPoolChanges.length === 0)}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={() => void applyStagedPoolChanges()}
                disabled={applyingStagedChanges || (stagedCards.length === 0 && stagedPoolChanges.length === 0)}
              >
                {applyingStagedChanges ? 'Applying...' : 'Apply Changes'}
              </button>
            </div>
          </div>

          {stagedCards.length === 0 && stagedPoolChanges.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No staged changes yet.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {stagedCards.map((card) => (
                <StagedOwnerCardRow
                  key={`${card.cachedCardId}-${card.phaseLabel}`}
                  name={card.name}
                  phaseLabel={card.phaseLabel}
                  imageUri={card.imageUri}
                  quantity={card.quantity}
                  applying={applyingStagedChanges}
                  onQuantityChange={(quantity) =>
                    updateStagedQuantity(card.cachedCardId, card.phaseLabel, quantity)
                  }
                  onRemove={() => removeStagedCard(card.cachedCardId, card.phaseLabel)}
                />
              ))}

              {stagedPoolChanges.map((change) => {
                const actionLabel =
                  change.action === 'add'
                    ? `Add +${change.quantity}`
                    : change.action === 'remove_one'
                      ? `Remove -${change.quantity}`
                      : 'Remove all';
                return (
                  <StagedChangeRow
                    key={change.id}
                    label={`${actionLabel} - ${change.cardName} (${change.phaseLabel})`}
                    imageUri={change.imageUri}
                    imageAlt={change.cardName}
                    applying={applyingStagedChanges}
                    onRemove={() => removeStagedPoolChange(change.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : null}

            <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        {isAdmin ? (
          <p className="text-xs text-muted-foreground">Admin tip: right-click any card to stage add/remove changes in a specific acquisition group.</p>
        ) : null}
        <ViewToolbar
          viewMode={viewMode}
          sortKey={sortKey}
          groupMode={groupMode}
          stacksOrganizeBy={stacksOrganizeBy}
          totalCards={visibleCardCount}
          disableVisualViews={disableVisualViews}
          selectedColorFilters={selectedColorFilters}
          selectedTypeFilters={selectedTypeFilters}
          showBasicLands={showBasicLands}
          onToggleColorFilter={(value) =>
            setSelectedColorFilters((prev) =>
              prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value],
            )
          }
          onToggleTypeFilter={(value) =>
            setSelectedTypeFilters((prev) =>
              prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value],
            )
          }
          onToggleShowBasicLands={(value) => setShowBasicLands(value)}
          onResetFilters={() => {
            setSelectedTypeFilters([...CARD_TYPE_FILTERS]);
            setSelectedColorFilters([...COLOR_FILTERS]);
          }}
          onChange={(next) => {
            if (next.viewMode) {
              setViewMode(next.viewMode);
            }
            if (next.sortKey) {
              setSortKey(next.sortKey);
            }
            if (next.groupMode) {
              setGroupMode(next.groupMode);
            }
            if (next.stacksOrganizeBy) {
              setStacksOrganizeBy(next.stacksOrganizeBy);
            }
          }}
        />
        {viewMode === 'stacks' ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2">
            <label htmlFor="stacks-size" className="text-xs font-medium text-muted-foreground">
              Card Size
            </label>
            <input
              id="stacks-size"
              type="range"
              min={160}
              max={280}
              step={10}
              value={stackCardWidth}
              onChange={(event) => setStackCardWidth(Number(event.target.value))}
              className="w-44 accent-primary"
            />
            <span className="text-xs text-muted-foreground">{stackCardWidth}px</span>
          </div>
        ) : null}
        <CardPreviewProvider>
          {viewMode === 'list' ? (
            <ListView
              cards={visibleCards}
              sortKey={sortKey}
              groupMode={groupMode}
              organizeBy={stacksOrganizeBy}
              onCardContextMenu={handleAdminCardContextMenu}
            />
          ) : null}
          {viewMode === 'grid' && !disableVisualViews ? (
            <GridView
              cards={visibleCards}
              sortKey={sortKey}
              groupMode={groupMode}
              organizeBy={stacksOrganizeBy}
              onCardContextMenu={handleAdminCardContextMenu}
            />
          ) : null}
          {viewMode === 'stacks' && !disableVisualViews ? (
            <StacksView
              cards={visibleCards}
              sortKey={sortKey}
              groupMode={groupMode}
              cardWidth={stackCardWidth}
              organizeBy={stacksOrganizeBy}
              onCardContextMenu={handleAdminCardContextMenu}
            />
          ) : null}
          {viewMode === 'curve' && !disableVisualViews ? (
            <CurveView
              cards={visibleCards}
              sortKey={sortKey}
              groupMode={groupMode}
              organizeBy={stacksOrganizeBy}
              onCardContextMenu={handleAdminCardContextMenu}
            />
          ) : null}
          <CardHoverPreview />
        </CardPreviewProvider>
        {isAdmin && adminContextMenu ? (
          <div
            className="absolute z-50 w-72 rounded-md border border-border bg-popover p-3 shadow-xl"
            style={{ left: Math.max(8, adminContextMenu.pageX), top: Math.max(8, adminContextMenu.pageY) }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <p className="text-sm font-semibold">{adminContextMenu.card.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Manage this card in a specific acquisition group.</p>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Acquisition Group
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={adminContextMenu.phaseLabel}
                onChange={(event) =>
                  setAdminContextMenu((prev) => (prev ? { ...prev, phaseLabel: event.target.value } : prev))
                }
                disabled={applyingStagedChanges}
              >
                {availablePhaseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">Copies in selected group: {selectedPhaseQuantity}</p>
            <p className="mt-1 text-xs text-muted-foreground">Total available after staged adds: {totalAvailableForSelection}</p>
            {stagedRemovalForSelection ? (
              <p className="mt-1 text-xs text-amber-600">
                Current staged removal:{' '}
                {stagedRemovalForSelection.action === 'remove_all'
                  ? 'Remove all'
                  : `Remove -${stagedRemovalForSelection.quantity}`}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                onClick={() => stagePoolChange('add')}
                disabled={applyingStagedChanges}
              >
                Stage +1
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                onClick={() => stagePoolChange('remove_one')}
                disabled={applyingStagedChanges || !canStageAnotherSingleRemoval}
              >
                Stage -1
              </button>
              <button
                type="button"
                className="rounded border border-destructive/50 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                onClick={() => stagePoolChange('remove_all')}
                disabled={applyingStagedChanges || totalAvailableForSelection < 1}
              >
                Stage All
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isOwner && isBulkAddOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsBulkAddOpen(false)}
        >
          <form
            className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 space-y-4"
            onSubmit={bulkAddCards}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Bulk Add Cards</h2>
                <p className="text-sm text-muted-foreground">
                  Paste one card per line. Prefix quantity like "2 Lightning Bolt". Choose the target phase below.
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                onClick={() => setIsBulkAddOpen(false)}
              >
                Close
              </button>
            </div>

            <label className="block text-sm font-medium">
              Phase Label
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={bulkPhaseLabel}
                onChange={(event) => setBulkPhaseLabel(event.target.value)}
              >
                {phaseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <textarea
              className="min-h-56 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={'Island\n2 Lightning Bolt\nCounterspell'}
            />

            {bulkAddedCount > 0 ? <p className="text-sm text-emerald-600">{bulkAddedCount} cards added.</p> : null}
            {bulkUnresolved.length > 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Some names could not be resolved:</p>
                <ul className="mt-2 list-disc pl-5">
                  {bulkUnresolved.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => setIsBulkAddOpen(false)}
                disabled={bulkAdding}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bulkAdding}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {bulkAdding ? 'Adding...' : 'Bulk Add'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
