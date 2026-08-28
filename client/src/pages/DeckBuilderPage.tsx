import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, authApiRequest } from '@/lib/api';
import { getPrimaryCardImageUrl } from '@/lib/cardImage';
import { useConfirm } from '@/context/ConfirmContext';
import { useCurrentLeague } from '@/hooks/useCurrentLeague';
import { CARD_TYPE_FILTERS, COLOR_FILTERS, filterPoolCards } from '@/lib/cardPoolFilters';
import { flattenEntries, sortCards } from '@/lib/cardPoolSort';
import { CurveView } from '@/components/cardpool/CurveView';
import { GridView } from '@/components/cardpool/GridView';
import { ListView } from '@/components/cardpool/ListView';
import { StacksView } from '@/components/cardpool/StacksView';
import { ViewToolbar } from '@/components/cardpool/ViewToolbar';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy, ViewMode } from '@/components/cardpool/types';
import { DeckAnalyticsView } from '@/components/deckbuilder/DeckAnalyticsView';
import { DeckBuildDetailsToggle } from '@/components/deckbuilder/DeckBuildDetailsToggle';
import { DeckBuilderContextMenu, type DeckBuilderMenuAction } from '@/components/deckbuilder/DeckBuilderContextMenu';
import { useCardImageWidth } from '@/hooks/useCardImageWidth';
import { DeckSidebar } from '@/components/deckbuilder/DeckSidebar';
import { DeckRegistrationCounter } from '@/components/deckbuilder/DeckRegistrationCounter';
import { DeckTabList } from '@/components/deckbuilder/DeckTabList';
import { DragGhost } from '@/components/deckbuilder/DragGhost';
import { DragProvider } from '@/components/deckbuilder/DragContext';
import { ImportDeckDialog, type ImportEntry } from '@/components/deckbuilder/ImportDeckDialog';
import { ShareDeckDialog } from '@/components/deckbuilder/ShareDeckDialog';
import { ExportDeckDialog } from '@/components/deckbuilder/ExportDeckDialog';
import { PoolCardBadge } from '@/components/deckbuilder/PoolCardBadge';
import type { BuilderDeck, DeckBuilderCard } from '@/components/deckbuilder/types';
import { toDeckSharePayload } from '@/lib/archiveDeck';
import { mintDeckShareUrl } from '@/lib/shareLink';
import { primaryName } from '@/lib/userDisplay';
import { useAuth } from '@/context/AuthContext';
import { DECKBUILDER_WORK_AREA_HEIGHT_CLASS } from '@/lib/deckBuilderLayout';
import {
  applyMainBasicLandsChange,
  applySideboardBasicLandsChange,
  deckEntryCards,
  extractBasicCounts,
  syncDeckBasicLands,
} from '@/lib/deckBasicLands';
import { moveCardBetweenZones } from '@/lib/deckMutations';
import {
  isExtraDeckSlot,
  PREP_DECK_SIZES,
  readStoredPrepSize,
  resolveBuilderSizeTarget,
  writeStoredPrepSize,
  type PrepDeckSize,
} from '@/lib/prepDeckSize';
import { buildPoolAllocationMaps, shouldIgnoreRegisteredAllocation } from '@mtg-league/shared';

type DecklistEntryResponse = {
  cachedCardId: string;
  quantity: number;
  zone: 'main' | 'sideboard';
  cachedCard: {
    name: string;
    layout: string | null;
    manaCost: string | null;
    typeLine: string;
    cmc: number;
    colorIdentity: string[];
    setCode?: string | null;
    collectorNumber?: string | null;
  };
};

type DecklistResponse = {
  id: string;
  orderIndex: number;
  name: string | null;
  status: 'draft' | 'submitted' | 'locked';
  entries: DecklistEntryResponse[];
};

type RoundDeckBuilderResponse = {
  data: {
    roundId: string;
    roundNumber: number;
    poolId: string;
    registeredCount?: number;
    decklists: DecklistResponse[];
    eventConfig: {
      format: 'swiss' | 'seeded_swiss' | 'round_robin';
      deckCount: number;
      minDeckSize: number;
      sideboardRule: 'entire_pool' | 'fixed_15' | 'none';
      deckLockingMode: 'required_before_round' | 'free_modification' | 'admin_locked';
    } | null;
    restrictedCards: Array<{
      cachedCardId: string;
      restrictedQty: number;
      reason: string;
    }>;
    basicLands: Array<{
      cachedCardId: string;
      name: string;
      manaCost: string | null;
      typeLine: string;
      colorIdentity: string[];
    }>;
    matchesComplete?: boolean;
  };
};

type PoolResponse = {
  data: {
    acquisitions: Array<{
      phaseLabel: string;
      entries: Array<{
        quantity: number;
        cachedCard: {
          scryfallId: string;
          name: string;
          layout?: string | null;
          manaCost: string | null;
          typeLine: string;
          rarity: string;
          setCode: string;
          imageUris: unknown;
          cmc: number;
          colors: string[];
          colorIdentity?: string[];
        };
      }>;
    }>;
  };
};

type DeckValidationResponse = {
  data: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    invalidCardIds?: string[];
  };
};

type DeckBuilderContextMenuState =
  | { source: 'pool'; pageX: number; pageY: number; card: PoolCard }
  | { source: 'deck'; pageX: number; pageY: number; card: DeckBuilderCard; deckId: string };

function getPoolCardAvailableQty(
  poolCard: PoolCard,
  restrictedQty: number,
  allocatedQty: number,
): number {
  return Math.max(0, poolCard.quantity - restrictedQty - allocatedQty);
}

function toDeckCards(entries: DecklistEntryResponse[]): DeckBuilderCard[] {
  return entries.map((entry) => ({
    cachedCardId: entry.cachedCardId,
    name: entry.cachedCard.name,
    layout: entry.cachedCard.layout ?? null,
    manaCost: entry.cachedCard.manaCost,
    typeLine: entry.cachedCard.typeLine,
    cmc: entry.cachedCard.cmc,
    quantity: entry.quantity,
    zone: entry.zone,
    colorIdentity: entry.cachedCard.colorIdentity ?? [],
    setCode: entry.cachedCard.setCode ?? null,
    collectorNumber: entry.cachedCard.collectorNumber ?? null,
  }));
}

export function DeckBuilderPage() {
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { activeSeasonId } = useCurrentLeague();
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [poolCards, setPoolCards] = useState<PoolCard[]>([]);
  const [decks, setDecks] = useState<BuilderDeck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [expandedDeckMode, setExpandedDeckMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveBlockedCardIdsByDeckId, setSaveBlockedCardIdsByDeckId] = useState<Record<string, string[]>>({});
  const [showRestrictedCards, setShowRestrictedCards] = useState(true);
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<string[]>([...CARD_TYPE_FILTERS]);
  const [selectedColorFilters, setSelectedColorFilters] = useState<string[]>([...COLOR_FILTERS]);
  const [showBasicLands, setShowBasicLands] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortKey, setSortKey] = useState<SortKey>('type');
  const [groupMode, setGroupMode] = useState<GroupMode>('flat');
  const [stacksOrganizeBy, setStacksOrganizeBy] = useState<StacksOrganizeBy>('type');
  const { cardImageWidth, setCardImageWidth } = useCardImageWidth();
  const poolScrollRef = useRef<HTMLDivElement>(null);
  const [minDeckSize, setMinDeckSize] = useState(40);
  const [prepDeckSizeByDeckId, setPrepDeckSizeByDeckId] = useState<Record<string, PrepDeckSize>>({});
  const [requiredDeckCount, setRequiredDeckCount] = useState(1);
  const [registeredDeckCount, setRegisteredDeckCount] = useState(0);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [eventFormat, setEventFormat] = useState<'swiss' | 'seeded_swiss' | 'round_robin' | null>(null);
  const [deckLockingMode, setDeckLockingMode] = useState<
    'required_before_round' | 'free_modification' | 'admin_locked'
  >('free_modification');
  const [activeRoundNumber, setActiveRoundNumber] = useState<number | null>(null);
  const [matchesComplete, setMatchesComplete] = useState(false);
  const [contextMenu, setContextMenu] = useState<DeckBuilderContextMenuState | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const restrictedMap = useRef(
    new Map<
      string,
      {
        restrictedQty: number;
        reason: string;
      }
    >(),
  );
  const basicLandCatalogRef = useRef(
    new Map<
      string,
      {
        cachedCardId: string;
        name: string;
        manaCost: string | null;
        typeLine: string;
        colorIdentity: string[];
      }
    >(),
  );

  const extractInvalidCardIds = (validation: DeckValidationResponse['data']) => {
    if (!Array.isArray(validation.invalidCardIds)) {
      return [];
    }
    return validation.invalidCardIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  };

  const refreshAllDeckValidations = async (deckIds: string[]) => {
    const uniqueDeckIds = [...new Set(deckIds.filter(Boolean))];
    if (uniqueDeckIds.length === 0) {
      return;
    }

    const entries = await Promise.all(
      uniqueDeckIds.map(async (deckId) => {
        try {
          const validation = await authApiRequest<DeckValidationResponse>(`/api/decklists/${deckId}/validate`);
          return [deckId, extractInvalidCardIds(validation.data)] as const;
        } catch {
          return [deckId, [] as string[]] as const;
        }
      }),
    );

    setSaveBlockedCardIdsByDeckId((prev) => {
      // Keep warnings sticky for this deck set until a successful save clears them.
      const next: Record<string, string[]> = {};
      for (const deckId of uniqueDeckIds) {
        if (prev[deckId]?.length) {
          next[deckId] = [...prev[deckId]];
        }
      }
      for (const [deckId, invalidCardIds] of entries) {
        if (invalidCardIds.length > 0) {
          next[deckId] = [...new Set([...(next[deckId] ?? []), ...invalidCardIds])];
        }
      }
      return next;
    });
  };

  const loadData = async () => {
    if (!eventId) {
      setError('Missing event id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const deckResponse = await authApiRequest<RoundDeckBuilderResponse>(`/api/events/${eventId}/my-decklists`);
      const poolResponse = await authApiRequest<PoolResponse>(`/api/card-pools/${deckResponse.data.poolId}`);

      const flattened = flattenEntries(poolResponse.data.acquisitions, 'flat');
      setPoolCards(flattened);

      const mappedDecks: BuilderDeck[] = deckResponse.data.decklists.map((decklist) => {
        const cards = toDeckCards(decklist.entries);
        return {
          id: decklist.id,
          orderIndex: decklist.orderIndex,
          name: decklist.name ?? `Deck ${decklist.orderIndex + 1}`,
          status: decklist.status,
          cards,
          basicLands: extractBasicCounts(cards),
        };
      });
      setDecks(mappedDecks);
      setActiveDeckId((prev) => prev ?? mappedDecks[0]?.id ?? null);
      setMinDeckSize(deckResponse.data.eventConfig?.minDeckSize ?? 40);
      setRequiredDeckCount(Math.max(1, deckResponse.data.eventConfig?.deckCount ?? 1));
      setPrepDeckSizeByDeckId(() => {
        const next: Record<string, PrepDeckSize> = {};
        const eventMin = deckResponse.data.eventConfig?.minDeckSize ?? 40;
        const deckCount = Math.max(1, deckResponse.data.eventConfig?.deckCount ?? 1);
        for (const deck of mappedDecks) {
          if (!isExtraDeckSlot(deck.orderIndex, deckCount)) {
            continue;
          }
          const resolved = resolveBuilderSizeTarget({
            orderIndex: deck.orderIndex,
            requiredDeckCount: deckCount,
            eventMinDeckSize: eventMin,
            stored: readStoredPrepSize(deck.id),
          });
          if (PREP_DECK_SIZES.includes(resolved as PrepDeckSize)) {
            next[deck.id] = resolved as PrepDeckSize;
          }
        }
        return next;
      });
      setRegisteredDeckCount(
        deckResponse.data.registeredCount ??
          mappedDecks.filter((deck) => deck.status === 'submitted' || deck.status === 'locked').length,
      );
      setActiveRoundId(deckResponse.data.roundId);
      setEventFormat(deckResponse.data.eventConfig?.format ?? null);
      setDeckLockingMode(deckResponse.data.eventConfig?.deckLockingMode ?? 'free_modification');
      setActiveRoundNumber(deckResponse.data.roundNumber);
      setMatchesComplete(deckResponse.data.matchesComplete === true);

      restrictedMap.current = new Map(
        deckResponse.data.restrictedCards.map((entry) => [
          entry.cachedCardId,
          { restrictedQty: entry.restrictedQty, reason: entry.reason },
        ]),
      );
      basicLandCatalogRef.current = new Map(deckResponse.data.basicLands.map((entry) => [entry.name, entry]));
      await refreshAllDeckValidations(mappedDecks.map((deck) => deck.id));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load deckbuilder');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      return;
    }
    let inFlight = false;
    const refreshMatchesComplete = async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      try {
        const deckResponse = await authApiRequest<RoundDeckBuilderResponse>(`/api/events/${eventId}/my-decklists`);
        setMatchesComplete(deckResponse.data.matchesComplete === true);
      } catch {
        // Keep the last known flag; the next focus/visibility can retry.
      } finally {
        inFlight = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void refreshMatchesComplete();
    };
    const onFocus = () => {
      void refreshMatchesComplete();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [eventId]);

  const allocationByDeckStatus = useMemo(() => {
    const activeDeckForAllocation = decks.find((deck) => deck.id === activeDeckId) ?? null;
    const ignoreRegistered = activeDeckForAllocation
      ? shouldIgnoreRegisteredAllocation({
          matchesComplete,
          status: activeDeckForAllocation.status,
        })
      : false;
    return buildPoolAllocationMaps(
      decks,
      activeDeckId,
      ignoreRegistered ? { ignoreRegisteredSiblings: true } : undefined,
    );
  }, [activeDeckId, decks, matchesComplete]);
  const combinedAllocationByCardId = allocationByDeckStatus.combinedForAvailability;
  const activeDeckAllocationByCardId = allocationByDeckStatus.activeDeckByCardId;
  const registeredOtherDecksByCardId = allocationByDeckStatus.registeredOtherDecksByCardId;

  const cardOverlayData = useMemo(() => {
    const map = new Map<
      string,
      {
        allocated: number;
        allocatedInActiveDeck: number;
        restricted: number;
        reason?: string;
      }
    >();

    for (const card of poolCards) {
      const allocated = combinedAllocationByCardId.get(card.scryfallId) ?? 0;
      const allocatedInActiveDeck = activeDeckAllocationByCardId.get(card.scryfallId) ?? 0;
      const restricted = restrictedMap.current.get(card.scryfallId)?.restrictedQty ?? 0;
      map.set(card.scryfallId, {
        allocated,
        allocatedInActiveDeck,
        restricted,
        reason: restrictedMap.current.get(card.scryfallId)?.reason,
      });
    }
    return map;
  }, [activeDeckAllocationByCardId, combinedAllocationByCardId, poolCards]);

  const visiblePoolCards = useMemo(() => {
    const filtered = filterPoolCards(sortCards(poolCards, sortKey), {
      selectedColorFilters,
      selectedTypeFilters,
      showBasicLands,
    });
    return filtered.filter((card) => {
      const restricted = restrictedMap.current.get(card.scryfallId)?.restrictedQty ?? 0;
      const allocated = combinedAllocationByCardId.get(card.scryfallId) ?? 0;
      const available = Math.max(0, card.quantity - restricted - allocated);
      if (!showRestrictedCards && restricted > 0 && available === 0) {
        return false;
      }
      return true;
    });
  }, [
    combinedAllocationByCardId,
    poolCards,
    selectedColorFilters,
    selectedTypeFilters,
    showBasicLands,
    showRestrictedCards,
    sortKey,
  ]);

  const poolCardCount = useMemo(
    () => poolCards.reduce((sum, card) => sum + card.quantity, 0),
    [poolCards],
  );
  const visiblePoolCardCount = useMemo(
    () => visiblePoolCards.reduce((sum, card) => sum + card.quantity, 0),
    [visiblePoolCards],
  );
  const poolCardByScryfallId = useMemo(
    () => new Map(poolCards.map((card) => [card.scryfallId, card])),
    [poolCards],
  );
  const basicLandCardIdSet = useMemo(
    () => new Set([...basicLandCatalogRef.current.values()].map((entry) => entry.cachedCardId)),
    [poolCards, decks],
  );
  const getImportIssueSummary = useCallback(
    (entries: ImportEntry[]) => {
      const importedAllocationByCardId = new Map<string, number>();
      const invalidCardIds = new Set<string>();
      const details: string[] = [];

      for (const entry of entries) {
        importedAllocationByCardId.set(
          entry.cachedCardId,
          (importedAllocationByCardId.get(entry.cachedCardId) ?? 0) + entry.quantity,
        );
      }

      for (const [cachedCardId, importedQty] of importedAllocationByCardId.entries()) {
        if (basicLandCardIdSet.has(cachedCardId)) {
          continue;
        }
        const poolCard = poolCardByScryfallId.get(cachedCardId);
        if (!poolCard) {
          invalidCardIds.add(cachedCardId);
          details.push(`- Unknown card (${cachedCardId}) is not in your current pool.`);
          continue;
        }
        const restrictedQty = restrictedMap.current.get(cachedCardId)?.restrictedQty ?? 0;
        const allowedQty = Math.max(0, poolCard.quantity - restrictedQty);
        const registeredOtherQty = registeredOtherDecksByCardId.get(cachedCardId) ?? 0;
        const attemptedTotal = registeredOtherQty + importedQty;
        if (attemptedTotal > allowedQty) {
          invalidCardIds.add(cachedCardId);
          const restrictionReason = restrictedMap.current.get(cachedCardId)?.reason;
          const reasonSuffix = restrictionReason ? ` (${restrictionReason})` : '';
          details.push(
            `- ${poolCard.name}: ${attemptedTotal} allocated across decks, ${allowedQty} allowed${reasonSuffix}.`,
          );
        }
      }

      const invalidCount = invalidCardIds.size;
      return {
        invalidCardIds: [...invalidCardIds],
        summary:
          invalidCount > 0
            ? `${invalidCount} card${invalidCount === 1 ? '' : 's'} fail current round constraints (pool copies, restrictions, or unavailable cards).`
            : 'No import issues detected.',
        details,
      };
    },
    [basicLandCardIdSet, poolCardByScryfallId, registeredOtherDecksByCardId],
  );

  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null;
  const activeDeckTargetSize = activeDeck
    ? resolveBuilderSizeTarget({
        orderIndex: activeDeck.orderIndex,
        requiredDeckCount,
        eventMinDeckSize: minDeckSize,
        stored: prepDeckSizeByDeckId[activeDeck.id] ?? null,
      })
    : minDeckSize;
  const showPrepSizeToggle = !!activeDeck && isExtraDeckSlot(activeDeck.orderIndex, requiredDeckCount);
  const showMatchCompleteExtraHint =
    !!activeDeck &&
    shouldIgnoreRegisteredAllocation({
      matchesComplete,
      status: activeDeck.status,
    });
  const activeDeckEditable =
    activeDeck?.status === 'draft' || (activeDeck?.status === 'submitted' && eventFormat === 'round_robin');
  const isDeckEditable = (deck: BuilderDeck) => deck.status === 'draft' || (deck.status === 'submitted' && eventFormat === 'round_robin');
  const isDeckRenamable = () => deckLockingMode !== 'admin_locked';
  const canRegisterActiveDeck =
    !!activeDeck && activeDeck.status === 'draft' && registeredDeckCount < requiredDeckCount;
  const canUnregisterActiveDeck = !!activeDeck && activeDeck.status === 'submitted';
  const canDeleteActiveDeck =
    !!activeDeck && activeDeck.status === 'draft' && decks.length > 1;
  const canImportActiveDeck = !!activeDeckEditable && !!activeSeasonId;
  const canExportActiveDeck = Boolean(activeDeck && activeDeck.cards.length > 0);
  const canShareActiveDeck = canExportActiveDeck;

  const openShare = async () => {
    if (!activeDeck || shareBusy || activeDeck.cards.length === 0) {
      return;
    }
    setShareBusy(true);
    try {
      const payload = toDeckSharePayload({
        ownerDisplayName: user
          ? primaryName({ displayName: user.displayName ?? '', publicName: user.publicName })
          : '',
        deckName: activeDeck.name,
        eventName: '',
        roundNumber: activeRoundNumber ?? 0,
        status: activeDeck.status,
        cards: activeDeck.cards,
      });
      setShareUrl(await mintDeckShareUrl(activeDeck.id, payload));
    } catch {
      setError('Failed to create share link');
    } finally {
      setShareBusy(false);
    }
  };
  const importDisabledReason = !activeSeasonId
    ? 'No active season found to import from.'
    : !activeDeckEditable
      ? 'Only editable decks can import previous decklists.'
      : undefined;
  const deleteActiveDeckDisabledReason = !activeDeck
    ? undefined
    : activeDeck.status !== 'draft'
      ? 'Only draft decks can be deleted. Unregister the deck first.'
      : decks.length <= 1
        ? 'Keep at least one deck for this event. Add another tab before deleting this one.'
        : undefined;

  const registerActiveDeck = async () => {
    if (!activeDeck) {
      return;
    }
    setSuccess(null);
    setError(null);
    try {
      const validation = await authApiRequest<DeckValidationResponse>(`/api/decklists/${activeDeck.id}/validate`);
      const invalidCardIds = extractInvalidCardIds(validation.data);
      if (invalidCardIds.length > 0) {
        setSaveBlockedCardIdsByDeckId((prev) => ({
          ...prev,
          [activeDeck.id]: invalidCardIds,
        }));
      }
      if (!validation.data.isValid) {
        const messages =
          validation.data.errors.length > 0
            ? validation.data.errors
            : ['Deck has invalid card allocation and cannot be registered.'];
        const formattedMessage = messages.map((message, index) => `${index + 1}. ${message}`).join(' ');
        await confirm({
          title: 'Cannot register deck',
          message: formattedMessage,
          confirmLabel: 'OK',
          cancelLabel: 'Close',
        });
        return;
      }
      if (validation.data.warnings.length > 0) {
        const formattedWarnings = validation.data.warnings
          .map((warning, index) => `${index + 1}. ${warning}`)
          .join(' ');
        const proceed = await confirm({
          title: 'Register with warnings?',
          message: formattedWarnings,
          confirmLabel: 'Register',
          cancelLabel: 'Cancel',
        });
        if (!proceed) {
          return;
        }
      }
      await authApiRequest(`/api/decklists/${activeDeck.id}/submit`, { method: 'POST' });
      setSuccess('Deck registered');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Unable to register deck');
    }
  };

  const unregisterActiveDeck = async () => {
    if (!activeDeck) {
      return;
    }
    setError(null);
    try {
      await authApiRequest(`/api/decklists/${activeDeck.id}/unsubmit`, { method: 'POST' });
      setSuccess('Deck unregistered');
      await loadData();
    } catch (unsubmitError) {
      setError(unsubmitError instanceof ApiError ? unsubmitError.message : 'Unable to unregister deck');
    }
  };

  const addDeck = async () => {
    if (!eventId || !activeRoundId) {
      return;
    }
    setError(null);
    try {
      await authApiRequest('/api/decklists', {
        method: 'POST',
        body: {
          eventId,
          roundId: activeRoundId,
        },
      });
      setSuccess('Deck added');
      await loadData();
    } catch (addError) {
      setError(addError instanceof ApiError ? addError.message : 'Unable to add deck');
    }
  };

  const importIntoActiveDeck = async (entries: ImportEntry[]) => {
    if (!activeDeck || !activeDeckEditable) {
      return;
    }
    setError(null);
    if (activeDeck.cards.length > 0) {
      const confirmed = await confirm({
        title: 'Replace current deck?',
        message: 'Importing a previous deck will replace all cards in the active deck.',
        confirmLabel: 'Replace',
        cancelLabel: 'Keep Current Deck',
      });
      if (!confirmed) {
        return;
      }
    }

    const importedCards: DeckBuilderCard[] = [];
    let skipped = 0;
    for (const entry of entries) {
      const poolCard = poolCardByScryfallId.get(entry.cachedCardId);
      if (!poolCard) {
        skipped += 1;
        continue;
      }
      importedCards.push({
        cachedCardId: entry.cachedCardId,
        name: poolCard.name,
        layout: poolCard.layout ?? null,
        manaCost: poolCard.manaCost,
        typeLine: poolCard.typeLine,
        cmc: poolCard.cmc,
        quantity: entry.quantity,
        zone: entry.zone,
        colorIdentity: poolCard.colorIdentity,
      });
    }
    const importIssues = getImportIssueSummary(entries);

    setDecks((prev) =>
      prev.map((deck) =>
        deck.id === activeDeck.id
          ? {
              ...deck,
              cards: importedCards,
              basicLands: extractBasicCounts(importedCards),
            }
          : deck,
      ),
    );
    setSaveBlockedCardIdsByDeckId((prev) => {
      if (importIssues.invalidCardIds.length === 0) {
        if (!(activeDeck.id in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[activeDeck.id];
        return next;
      }
      return {
        ...prev,
        [activeDeck.id]: importIssues.invalidCardIds,
      };
    });
    setShowImportDialog(false);
    if (skipped > 0) {
      setSuccess(`Imported ${importedCards.length} cards (${skipped} skipped - not in pool)`);
      return;
    }
    setSuccess(`Imported ${importedCards.length} cards`);
  };

  const deleteActiveDeck = async () => {
    if (!activeDeck) {
      return;
    }
    const confirmed = await confirm({
      title: 'Delete deck',
      message: `Delete "${activeDeck.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await authApiRequest(`/api/decklists/${activeDeck.id}`, { method: 'DELETE' });
      setSuccess('Deck deleted');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : 'Unable to delete deck');
    }
  };

  const saveDeck = async (deck: BuilderDeck) => {
    await authApiRequest(`/api/decklists/${deck.id}`, {
      method: 'PATCH',
      body: {
        name: deck.name,
        entries: deckEntryCards(deck),
      },
    });
  };

  const saveDeckName = async (deck: BuilderDeck) => {
    await authApiRequest(`/api/decklists/${deck.id}`, {
      method: 'PATCH',
      body: { name: deck.name },
    });
  };

  useEffect(() => {
    if (loading || decks.length === 0) {
      return;
    }
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        const activeDeckFirst = activeDeckId
          ? [
              ...decks.filter((deck) => deck.id === activeDeckId),
              ...decks.filter((deck) => deck.id !== activeDeckId),
            ]
          : decks;
        const editableDecks = activeDeckFirst.filter((deck) => isDeckEditable(deck));
        const renamableOnlyDecks = activeDeckFirst.filter(
          (deck) => !isDeckEditable(deck) && isDeckRenamable(),
        );
        if (editableDecks.length === 0 && renamableOnlyDecks.length === 0) {
          setSuccess('Saved');
          return;
        }

        for (const deck of editableDecks) {
          try {
            await saveDeck(deck);
            setSaveBlockedCardIdsByDeckId((prev) => {
              if (!(deck.id in prev)) {
                return prev;
              }
              const next = { ...prev };
              delete next[deck.id];
              return next;
            });
          } catch (saveError) {
            if (
              saveError instanceof ApiError &&
              saveError.code === 'VALIDATION_ERROR' &&
              typeof saveError.fields?.cachedCardId === 'string'
            ) {
              const blockedCardId = saveError.fields.cachedCardId;
              setSaveBlockedCardIdsByDeckId((prev) => ({
                ...prev,
                [deck.id]: [...new Set([...(prev[deck.id] ?? []), blockedCardId])],
              }));
            }
            throw saveError;
          }
        }

        for (const deck of renamableOnlyDecks) {
          await saveDeckName(deck);
        }
        setSuccess('Saved');
      } catch (saveError) {
        setError(saveError instanceof ApiError ? saveError.message : 'Save failed');
      } finally {
        await refreshAllDeckValidations(decks.map((deck) => deck.id));
        setSaving(false);
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks, loading, eventFormat, deckLockingMode]);

  useEffect(() => {
    setSaveBlockedCardIdsByDeckId((prev) => {
      let changed = false;
      const deckById = new Map(decks.map((deck) => [deck.id, deck]));
      const next: Record<string, string[]> = {};

      for (const [deckId, blockedIds] of Object.entries(prev)) {
        const deck = deckById.get(deckId);
        if (!deck) {
          changed = true;
          continue;
        }
        const presentIds = new Set(deck.cards.map((card) => card.cachedCardId));
        const filtered = blockedIds.filter((id) => presentIds.has(id));
        if (filtered.length > 0) {
          next[deckId] = filtered;
        }
        if (filtered.length !== blockedIds.length) {
          changed = true;
        }
      }

      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [decks]);

  const addCardToActiveDeck = (poolCard: PoolCard, zone: 'main' | 'sideboard' = 'main') => {
    if (!activeDeckId || !activeDeck || !isDeckEditable(activeDeck)) {
      return;
    }
    const restricted = restrictedMap.current.get(poolCard.scryfallId)?.restrictedQty ?? 0;
    const allocated = combinedAllocationByCardId.get(poolCard.scryfallId) ?? 0;
    const available = getPoolCardAvailableQty(poolCard, restricted, allocated);
    if (available < 1) {
      return;
    }

    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== activeDeckId) {
          return deck;
        }
        const existingIndex = deck.cards.findIndex((card) => card.cachedCardId === poolCard.scryfallId && card.zone === zone);
        let nextDeck: BuilderDeck;
        if (existingIndex === -1) {
          nextDeck = {
            ...deck,
            cards: [
              ...deck.cards,
              {
                cachedCardId: poolCard.scryfallId,
                name: poolCard.name,
                layout: poolCard.layout,
                manaCost: poolCard.manaCost,
                typeLine: poolCard.typeLine,
                cmc: poolCard.cmc,
                quantity: 1,
                zone,
                colorIdentity: poolCard.colorIdentity,
                setCode: poolCard.setCode,
              },
            ],
          };
        } else {
          const nextCards = [...deck.cards];
          nextCards[existingIndex] = {
            ...nextCards[existingIndex],
            quantity: nextCards[existingIndex].quantity + 1,
          };
          nextDeck = { ...deck, cards: nextCards };
        }
        return syncDeckBasicLands(nextDeck);
      }),
    );
  };

  const poolImageByCardId = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of poolCards) {
      const url = getPrimaryCardImageUrl(card.imageUris, ['normal', 'border_crop', 'small']);
      if (url) {
        map.set(card.scryfallId, url);
      }
    }
    return map;
  }, [poolCards]);

  const poolTouchActions = useCallback(
    (card: PoolCard) => [
      { label: 'Add to main deck', onAction: () => addCardToActiveDeck(card, 'main') },
      { label: 'Add to sideboard', onAction: () => addCardToActiveDeck(card, 'sideboard') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDeckId, poolCards, decks],
  );

  const removeCardFromDeck = (card: DeckBuilderCard, deckId: string) => {
    const targetDeck = decks.find((deck) => deck.id === deckId);
    if (!targetDeck || !isDeckEditable(targetDeck)) {
      return;
    }
    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== deckId) {
          return deck;
        }
        const idx = deck.cards.findIndex((entry) => entry.cachedCardId === card.cachedCardId && entry.zone === card.zone);
        if (idx === -1) {
          return deck;
        }
        const nextCards = [...deck.cards];
        if (nextCards[idx].quantity <= 1) {
          nextCards.splice(idx, 1);
        } else {
          nextCards[idx] = { ...nextCards[idx], quantity: nextCards[idx].quantity - 1 };
        }
        return syncDeckBasicLands({ ...deck, cards: nextCards });
      }),
    );
  };

  const handlePoolCardContextMenu = (event: MouseEvent, card: PoolCard) => {
    event.preventDefault();
    setContextMenu({
      source: 'pool',
      pageX: event.pageX,
      pageY: event.pageY,
      card,
    });
  };

  const handleDeckCardContextMenu = (event: MouseEvent, card: DeckBuilderCard, deckId: string) => {
    event.preventDefault();
    setContextMenu({
      source: 'deck',
      pageX: event.pageX,
      pageY: event.pageY,
      card,
      deckId,
    });
  };

  const contextMenuActions = useMemo((): DeckBuilderMenuAction[] => {
    if (!contextMenu) {
      return [];
    }

    if (contextMenu.source === 'pool') {
      const restricted = restrictedMap.current.get(contextMenu.card.scryfallId)?.restrictedQty ?? 0;
      const allocated = combinedAllocationByCardId.get(contextMenu.card.scryfallId) ?? 0;
      const available = getPoolCardAvailableQty(contextMenu.card, restricted, allocated);
      const disabled = available < 1 || !activeDeck || !isDeckEditable(activeDeck);

      return [
        {
          label: 'Add to main deck',
          disabled,
          onAction: () => {
            addCardToActiveDeck(contextMenu.card, 'main');
            setContextMenu(null);
          },
        },
        {
          label: 'Add to sideboard',
          disabled,
          onAction: () => {
            addCardToActiveDeck(contextMenu.card, 'sideboard');
            setContextMenu(null);
          },
        },
      ];
    }

    const targetZone = contextMenu.card.zone === 'main' ? 'sideboard' : 'main';
    const moveLabel = contextMenu.card.zone === 'main' ? 'Move to sideboard' : 'Move to main deck';
    const contextDeck = decks.find((deck) => deck.id === contextMenu.deckId);
    const contextDeckLocked = !contextDeck || !isDeckEditable(contextDeck);

    return [
      {
        label: moveLabel,
        disabled: contextDeckLocked,
        onAction: () => {
          setDecks((prev) =>
            moveCardBetweenZones(
              prev,
              contextMenu.deckId,
              contextMenu.card.cachedCardId,
              contextMenu.card.zone,
              targetZone,
            ).map((deck) => (deck.id === contextMenu.deckId ? syncDeckBasicLands(deck) : deck)),
          );
          setContextMenu(null);
        },
      },
      {
        label: 'Remove one',
        disabled: contextDeckLocked,
        onAction: () => {
          removeCardFromDeck(contextMenu.card, contextMenu.deckId);
          setContextMenu(null);
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu, combinedAllocationByCardId, activeDeckId, poolCards, decks]);

  const contextMenuCardName = contextMenu?.source === 'pool' ? contextMenu.card.name : contextMenu?.card.name ?? '';

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading deckbuilder...</p>;
  }

  if (error && decks.length === 0) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <DragProvider>
      <div className="flex min-h-0 flex-1 flex-col space-y-2 lg:overflow-hidden" data-testid="deckbuilder-page-root">
        <div
          className="flex shrink-0 flex-wrap items-start justify-between gap-2"
          data-testid="deckbuilder-page-header"
        >
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight tracking-tight">Deckbuilder</h1>
            <p className="text-xs leading-tight text-muted-foreground">
              {saving ? 'Saving...' : success ? success : activeRoundNumber ? `Using Round ${activeRoundNumber}` : 'Ready'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div
              className="flex flex-nowrap items-center gap-2"
              data-testid="deckbuilder-header-controls"
            >
              <DeckRegistrationCounter
                decks={decks}
                registeredCount={registeredDeckCount}
                requiredCount={requiredDeckCount}
              />
              <DeckTabList
                decks={decks}
                activeDeckId={activeDeckId ?? ''}
                onActiveDeckChange={setActiveDeckId}
              />
              <div className="flex shrink-0 items-center gap-1 border-l border-border/60 pl-2">
                <button
                  type="button"
                  data-testid="deck-add-button"
                  className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void addDeck()}
                >
                  Add
                </button>
                <button
                  type="button"
                  data-testid="deck-import-button"
                  className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canImportActiveDeck}
                  title={importDisabledReason}
                  onClick={() => setShowImportDialog(true)}
                >
                  Import
                </button>
                <button
                  type="button"
                  data-testid="deck-export-button"
                  className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canExportActiveDeck}
                  title={canExportActiveDeck ? undefined : 'Nothing to export.'}
                  onClick={() => setShowExportDialog(true)}
                >
                  Export
                </button>
                <button
                  type="button"
                  data-testid="deck-share-button"
                  className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canShareActiveDeck || shareBusy}
                  title={canShareActiveDeck ? undefined : 'Nothing to share.'}
                  onClick={openShare}
                >
                  Share
                </button>
                <button
                  type="button"
                  data-testid="deck-register-button"
                  className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canRegisterActiveDeck}
                  onClick={() => void registerActiveDeck()}
                >
                  Register
                </button>
                <button
                  type="button"
                  data-testid="deck-unregister-button"
                  className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUnregisterActiveDeck}
                  onClick={() => void unregisterActiveDeck()}
                >
                  Unregister
                </button>
                <button
                  type="button"
                  data-testid="deck-delete-button"
                  className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canDeleteActiveDeck}
                  title={deleteActiveDeckDisabledReason}
                  onClick={() => void deleteActiveDeck()}
                >
                  Delete
                </button>
              </div>
            </div>
            <div data-testid="deckbuilder-header-view-row">
              <DeckBuildDetailsToggle
                expandedDeckMode={expandedDeckMode}
                onChange={setExpandedDeckMode}
              />
            </div>
          </div>
        </div>

        {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}

        {expandedDeckMode && activeDeck ? (
          <div
            className={`min-h-0 flex-1 overflow-y-auto ${DECKBUILDER_WORK_AREA_HEIGHT_CLASS}`}
            data-testid="deckbuilder-details-area"
          >
            <DeckAnalyticsView
              deck={activeDeck}
              poolImageByCardId={poolImageByCardId}
              editable={activeDeckEditable}
              onCardClick={removeCardFromDeck}
              onCardContextMenu={handleDeckCardContextMenu}
            />
          </div>
        ) : (
          <div
            className={`grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,24vw)] lg:overflow-hidden ${DECKBUILDER_WORK_AREA_HEIGHT_CLASS}`}
            data-testid="deckbuilder-work-area"
          >
            <div
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-3"
              data-testid="deckbuilder-pool-column"
            >
              <div
                className="shrink-0 border-b border-border/60 pb-2"
                data-testid="deckbuilder-pool-toolbar"
              >
                <ViewToolbar
                  className="gap-2 p-2"
                  viewMode={viewMode}
                sortKey={sortKey}
                groupMode={groupMode}
                stacksOrganizeBy={stacksOrganizeBy}
                visibleCardCount={visiblePoolCardCount}
                poolCardCount={poolCardCount}
                selectedColorFilters={selectedColorFilters}
                selectedTypeFilters={selectedTypeFilters}
                showBasicLands={showBasicLands}
                showRestrictedCards={showRestrictedCards}
                allowRestrictedFilterToggle
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
                onToggleShowRestrictedCards={(value) => setShowRestrictedCards(value)}
                onResetFilters={() => {
                  setSelectedTypeFilters([...CARD_TYPE_FILTERS]);
                  setSelectedColorFilters([...COLOR_FILTERS]);
                }}
                cardImageWidth={cardImageWidth}
                onCardImageWidthChange={setCardImageWidth}
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
              </div>

              <div
                ref={poolScrollRef}
                className="min-h-0 flex-1 overflow-y-auto pt-2"
                data-testid="deckbuilder-pool-scroll"
              >
              {viewMode === 'list' ? (
                  <ListView
                    cards={visiblePoolCards}
                    sortKey={sortKey}
                    groupMode={groupMode}
                    organizeBy={stacksOrganizeBy}
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    onCardContextMenu={handlePoolCardContextMenu}
                    getTouchActions={poolTouchActions}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
                          allocatedInActiveDeck={data?.allocatedInActiveDeck ?? 0}
                          restricted={showRestrictedCards ? data?.restricted ?? 0 : 0}
                          restrictionReason={data?.reason}
                        />
                      );
                    }}
                  />
                ) : null}

                {viewMode === 'grid' ? (
                  <GridView
                    cards={visiblePoolCards}
                    sortKey={sortKey}
                    groupMode={groupMode}
                    organizeBy={stacksOrganizeBy}
                    cardWidth={cardImageWidth}
                    scrollElementRef={poolScrollRef}
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    onCardContextMenu={handlePoolCardContextMenu}
                    getTouchActions={poolTouchActions}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
                          allocatedInActiveDeck={data?.allocatedInActiveDeck ?? 0}
                          restricted={showRestrictedCards ? data?.restricted ?? 0 : 0}
                          restrictionReason={data?.reason}
                        />
                      );
                    }}
                  />
                ) : null}

                {viewMode === 'stacks' ? (
                  <StacksView
                    cards={visiblePoolCards}
                    sortKey={sortKey}
                    groupMode={groupMode}
                    organizeBy={stacksOrganizeBy}
                    cardWidth={cardImageWidth}
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    onCardContextMenu={handlePoolCardContextMenu}
                    getTouchActions={poolTouchActions}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
                          allocatedInActiveDeck={data?.allocatedInActiveDeck ?? 0}
                          restricted={showRestrictedCards ? data?.restricted ?? 0 : 0}
                          restrictionReason={data?.reason}
                        />
                      );
                    }}
                  />
                ) : null}

                {viewMode === 'curve' ? (
                  <CurveView
                    cards={visiblePoolCards}
                    sortKey={sortKey}
                    groupMode={groupMode}
                    organizeBy={stacksOrganizeBy}
                    cardWidth={cardImageWidth}
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    onCardContextMenu={handlePoolCardContextMenu}
                    getTouchActions={poolTouchActions}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
                          allocatedInActiveDeck={data?.allocatedInActiveDeck ?? 0}
                          restricted={showRestrictedCards ? data?.restricted ?? 0 : 0}
                          restrictionReason={data?.reason}
                        />
                      );
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div
              className="flex min-h-0 h-full flex-col overflow-hidden"
              data-testid="deckbuilder-sidebar-column"
            >
              <DeckSidebar
                decks={decks}
                activeDeckId={activeDeckId ?? ''}
                minDeckSize={activeDeckTargetSize}
                poolImageByCardId={poolImageByCardId}
                saveBlockedCardIdsByDeckId={saveBlockedCardIdsByDeckId}
                prepSizeToggle={
                  showPrepSizeToggle && activeDeck
                    ? {
                        value: prepDeckSizeByDeckId[activeDeck.id] ?? (activeDeckTargetSize as PrepDeckSize),
                        onChange: (size) => {
                          setPrepDeckSizeByDeckId((prev) => ({ ...prev, [activeDeck.id]: size }));
                          writeStoredPrepSize(activeDeck.id, size);
                        },
                      }
                    : undefined
                }
                matchCompleteExtraHint={showMatchCompleteExtraHint}
                onDeckNameChange={(deckId, name) =>
                  setDecks((prev) =>
                    prev.map((deck) => (deck.id === deckId && isDeckRenamable() ? { ...deck, name } : deck))
                  )
                }
                onCardClick={removeCardFromDeck}
                onCardContextMenu={handleDeckCardContextMenu}
                onBasicLandsChange={(deckId, next) => {
                  setDecks((prev) =>
                    prev.map((deck) => {
                      if (deck.id !== deckId) {
                        return deck;
                      }
                      if (!isDeckEditable(deck)) {
                        return deck;
                      }
                      return applyMainBasicLandsChange(deck, next, basicLandCatalogRef.current);
                    }),
                  );
                }}
                onSideboardBasicLandsChange={(deckId, next) => {
                  setDecks((prev) =>
                    prev.map((deck) => {
                      if (deck.id !== deckId) {
                        return deck;
                      }
                      if (!isDeckEditable(deck)) {
                        return deck;
                      }
                      return applySideboardBasicLandsChange(deck, next, basicLandCatalogRef.current);
                    }),
                  );
                }}
                disabled={!activeDeckEditable}
                nameDisabled={!isDeckRenamable()}
              />
            </div>
          </div>
        )}
      </div>
      <ImportDeckDialog
        open={showImportDialog}
        seasonId={activeSeasonId}
        excludeEventId={eventId}
        getEntryIssueSummary={getImportIssueSummary}
        onClose={() => setShowImportDialog(false)}
        onImport={(entries) => {
          void importIntoActiveDeck(entries);
        }}
      />
      {shareUrl ? <ShareDeckDialog url={shareUrl} onClose={() => setShareUrl(null)} /> : null}
      {showExportDialog && activeDeck ? (
        <ExportDeckDialog
          deckName={activeDeck.name}
          cards={activeDeck.cards}
          onClose={() => setShowExportDialog(false)}
        />
      ) : null}
      {contextMenu ? (
        <DeckBuilderContextMenu
          cardName={contextMenuCardName}
          pageX={contextMenu.pageX}
          pageY={contextMenu.pageY}
          actions={contextMenuActions}
          onDismiss={() => setContextMenu(null)}
        />
      ) : null}
      <DragGhost />
    </DragProvider>
  );
}

