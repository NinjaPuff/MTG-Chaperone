import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiRequest } from '@/lib/api';
import { CARD_TYPE_FILTERS, COLOR_FILTERS, filterPoolCards } from '@/lib/cardPoolFilters';
import { flattenEntries, sortCards } from '@/lib/cardPoolSort';
import { CardHoverPreview } from '@/components/cardpool/CardHoverPreview';
import { CardPreviewProvider } from '@/components/cardpool/CardPreviewContext';
import { CurveView } from '@/components/cardpool/CurveView';
import { GridView } from '@/components/cardpool/GridView';
import { ListView } from '@/components/cardpool/ListView';
import { StacksView } from '@/components/cardpool/StacksView';
import { ViewToolbar } from '@/components/cardpool/ViewToolbar';
import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy, ViewMode } from '@/components/cardpool/types';
import { DeckAnalyticsView } from '@/components/deckbuilder/DeckAnalyticsView';
import { DeckSidebar } from '@/components/deckbuilder/DeckSidebar';
import { DragGhost } from '@/components/deckbuilder/DragGhost';
import { DragProvider } from '@/components/deckbuilder/DragContext';
import { PoolCardBadge } from '@/components/deckbuilder/PoolCardBadge';
import type { BuilderDeck, DeckBuilderCard } from '@/components/deckbuilder/types';

type DecklistEntryResponse = {
  cachedCardId: string;
  quantity: number;
  zone: 'main' | 'sideboard';
  cachedCard: {
    name: string;
    manaCost: string | null;
    typeLine: string;
    cmc: number;
    colorIdentity: string[];
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
    decklists: DecklistResponse[];
    eventConfig: {
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

const BASIC_LAND_ORDER = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'] as const;

function toDeckCards(entries: DecklistEntryResponse[]): DeckBuilderCard[] {
  return entries.map((entry) => ({
    cachedCardId: entry.cachedCardId,
    name: entry.cachedCard.name,
    manaCost: entry.cachedCard.manaCost,
    typeLine: entry.cachedCard.typeLine,
    cmc: entry.cachedCard.cmc,
    quantity: entry.quantity,
    zone: entry.zone,
    colorIdentity: entry.cachedCard.colorIdentity ?? [],
  }));
}

function getDefaultBasicLandCounts() {
  return {
    Plains: 0,
    Island: 0,
    Swamp: 0,
    Mountain: 0,
    Forest: 0,
    Wastes: 0,
  };
}

function extractBasicCounts(cards: DeckBuilderCard[]) {
  const counts = getDefaultBasicLandCounts();
  for (const card of cards) {
    if (card.zone !== 'main') {
      continue;
    }
    if (BASIC_LAND_ORDER.includes(card.name as (typeof BASIC_LAND_ORDER)[number])) {
      counts[card.name as (typeof BASIC_LAND_ORDER)[number]] += card.quantity;
    }
  }
  return counts;
}

export function DeckBuilderPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [poolCards, setPoolCards] = useState<PoolCard[]>([]);
  const [decks, setDecks] = useState<BuilderDeck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [expandedDeckMode, setExpandedDeckMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRestrictedCards, setShowRestrictedCards] = useState(true);
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<string[]>([...CARD_TYPE_FILTERS]);
  const [selectedColorFilters, setSelectedColorFilters] = useState<string[]>([...COLOR_FILTERS]);
  const [showBasicLands, setShowBasicLands] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortKey, setSortKey] = useState<SortKey>('type');
  const [groupMode, setGroupMode] = useState<GroupMode>('flat');
  const [stacksOrganizeBy, setStacksOrganizeBy] = useState<StacksOrganizeBy>('type');
  const [stackCardWidth, setStackCardWidth] = useState(210);
  const [minDeckSize, setMinDeckSize] = useState(40);
  const [activeRoundNumber, setActiveRoundNumber] = useState<number | null>(null);
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

  const loadData = async () => {
    if (!eventId) {
      setError('Missing event id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const deckResponse = await apiRequest<RoundDeckBuilderResponse>(`/api/events/${eventId}/my-decklists`);
      const poolResponse = await apiRequest<PoolResponse>(`/api/card-pools/${deckResponse.data.poolId}`);

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
      setActiveRoundNumber(deckResponse.data.roundNumber);

      restrictedMap.current = new Map(
        deckResponse.data.restrictedCards.map((entry) => [
          entry.cachedCardId,
          { restrictedQty: entry.restrictedQty, reason: entry.reason },
        ]),
      );
      basicLandCatalogRef.current = new Map(deckResponse.data.basicLands.map((entry) => [entry.name, entry]));
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

  const combinedAllocationByCardId = useMemo(() => {
    const map = new Map<string, number>();
    for (const deck of decks) {
      for (const card of deck.cards) {
        map.set(card.cachedCardId, (map.get(card.cachedCardId) ?? 0) + card.quantity);
      }
    }
    return map;
  }, [decks]);

  const cardOverlayData = useMemo(() => {
    const map = new Map<
      string,
      {
        allocated: number;
        restricted: number;
        reason?: string;
      }
    >();

    for (const card of poolCards) {
      const allocated = combinedAllocationByCardId.get(card.scryfallId) ?? 0;
      const restricted = restrictedMap.current.get(card.scryfallId)?.restrictedQty ?? 0;
      map.set(card.scryfallId, {
        allocated,
        restricted,
        reason: restrictedMap.current.get(card.scryfallId)?.reason,
      });
    }
    return map;
  }, [combinedAllocationByCardId, poolCards]);

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

  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null;

  const saveDeck = async (deck: BuilderDeck) => {
    const basicEntries = BASIC_LAND_ORDER.flatMap((landName) => {
      const qty = deck.basicLands[landName];
      const basic = basicLandCatalogRef.current.get(landName);
      if (!basic || qty < 1) {
        return [];
      }
      return [
        {
          cachedCardId: basic.cachedCardId,
          quantity: qty,
          zone: 'main' as const,
        },
      ];
    });

    const nonBasicEntries = deck.cards
      .filter((card) => !BASIC_LAND_ORDER.includes(card.name as (typeof BASIC_LAND_ORDER)[number]))
      .map((card) => ({
        cachedCardId: card.cachedCardId,
        quantity: card.quantity,
        zone: card.zone,
      }));

    await apiRequest(`/api/decklists/${deck.id}`, {
      method: 'PATCH',
      body: {
        name: deck.name,
        entries: [...nonBasicEntries, ...basicEntries],
      },
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
        for (const deck of decks) {
          await saveDeck(deck);
        }
        setSuccess('Saved');
      } catch (saveError) {
        setError(saveError instanceof ApiError ? saveError.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks, loading]);

  const addCardToActiveDeck = (poolCard: PoolCard, zone: 'main' | 'sideboard' = 'main') => {
    if (!activeDeckId) {
      return;
    }
    const restricted = restrictedMap.current.get(poolCard.scryfallId)?.restrictedQty ?? 0;
    const allocated = combinedAllocationByCardId.get(poolCard.scryfallId) ?? 0;
    const available = Math.max(0, poolCard.quantity - restricted - allocated);
    if (available < 1) {
      return;
    }

    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== activeDeckId) {
          return deck;
        }
        const existingIndex = deck.cards.findIndex((card) => card.cachedCardId === poolCard.scryfallId && card.zone === zone);
        if (existingIndex === -1) {
          return {
            ...deck,
            cards: [
              ...deck.cards,
              {
                cachedCardId: poolCard.scryfallId,
                name: poolCard.name,
                manaCost: poolCard.manaCost,
                typeLine: poolCard.typeLine,
                cmc: poolCard.cmc,
                quantity: 1,
                zone,
                colorIdentity: poolCard.colorIdentity,
              },
            ],
          };
        }
        const nextCards = [...deck.cards];
        nextCards[existingIndex] = {
          ...nextCards[existingIndex],
          quantity: nextCards[existingIndex].quantity + 1,
        };
        return { ...deck, cards: nextCards };
      }),
    );
  };

  const removeCardFromDeck = (card: DeckBuilderCard, deckId: string) => {
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
        return { ...deck, cards: nextCards };
      }),
    );
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading deckbuilder...</p>;
  }

  if (error && decks.length === 0) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <DragProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Deckbuilder</h1>
            <p className="text-sm text-muted-foreground">
              {saving ? 'Saving...' : success ? success : activeRoundNumber ? `Using Round ${activeRoundNumber}` : 'Ready'}
            </p>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {expandedDeckMode && activeDeck ? (
          <DeckAnalyticsView
            deck={activeDeck}
            expandedDeckMode={expandedDeckMode}
            onExpandedDeckModeChange={setExpandedDeckMode}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <ViewToolbar
                viewMode={viewMode}
                sortKey={sortKey}
                groupMode={groupMode}
                stacksOrganizeBy={stacksOrganizeBy}
                totalCards={visiblePoolCards.reduce((sum, card) => sum + card.quantity, 0)}
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
                <div className="flex items-center gap-2">
                  <label htmlFor="deckbuilder-stack-size" className="text-xs text-muted-foreground">
                    Card size
                  </label>
                  <input
                    id="deckbuilder-stack-size"
                    type="range"
                    min={160}
                    max={280}
                    step={10}
                    value={stackCardWidth}
                    onChange={(event) => setStackCardWidth(Number(event.target.value))}
                    className="w-44 accent-primary"
                  />
                </div>
              ) : null}

              <CardPreviewProvider>
                {viewMode === 'list' ? (
                  <ListView
                    cards={visiblePoolCards}
                    sortKey={sortKey}
                    groupMode={groupMode}
                    organizeBy={stacksOrganizeBy}
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
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
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
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
                    cardWidth={stackCardWidth}
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
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
                    onCardClick={(card) => addCardToActiveDeck(card, 'main')}
                    renderBadge={(card) => {
                      const data = cardOverlayData.get(card.scryfallId);
                      return (
                        <PoolCardBadge
                          allocated={data?.allocated ?? 0}
                          restricted={showRestrictedCards ? data?.restricted ?? 0 : 0}
                          restrictionReason={data?.reason}
                        />
                      );
                    }}
                  />
                ) : null}
                <CardHoverPreview />
              </CardPreviewProvider>
            </div>

            <div className="min-h-[640px]">
              <DeckSidebar
                decks={decks}
                activeDeckId={activeDeckId ?? ''}
                minDeckSize={minDeckSize}
                expandedDeckMode={expandedDeckMode}
                onExpandedDeckModeChange={setExpandedDeckMode}
                onActiveDeckChange={setActiveDeckId}
                onDeckNameChange={(deckId, name) =>
                  setDecks((prev) => prev.map((deck) => (deck.id === deckId ? { ...deck, name } : deck)))
                }
                onCardClick={removeCardFromDeck}
                onBasicLandsChange={(deckId, next) => {
                  setDecks((prev) =>
                    prev.map((deck) => {
                      if (deck.id !== deckId) {
                        return deck;
                      }
                      const nonBasicCards = deck.cards.filter(
                        (card) => !BASIC_LAND_ORDER.includes(card.name as (typeof BASIC_LAND_ORDER)[number]),
                      );
                      const basicCards: DeckBuilderCard[] = BASIC_LAND_ORDER.flatMap((landName) => {
                        const qty = next[landName];
                        const catalog = basicLandCatalogRef.current.get(landName);
                        if (!catalog || qty < 1) {
                          return [];
                        }
                        return [
                          {
                            cachedCardId: catalog.cachedCardId,
                            name: catalog.name,
                            manaCost: catalog.manaCost,
                            typeLine: catalog.typeLine,
                            cmc: 0,
                            quantity: qty,
                            zone: 'main' as const,
                            colorIdentity: catalog.colorIdentity,
                          },
                        ];
                      });
                      return {
                        ...deck,
                        cards: [...nonBasicCards, ...basicCards],
                        basicLands: next,
                      };
                    }),
                  );
                }}
              />
            </div>
          </div>
        )}
      </div>
      <DragGhost />
    </DragProvider>
  );
}

