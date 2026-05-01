import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiRequest, getStoredToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { primaryName, secondaryName } from '@/lib/userDisplay';

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
};

type PhaseGroupedCard = {
  key: string;
  name: string;
  quantity: number;
  setCodes: string[];
  manaCost: string | null;
  imageUri: string | null;
};

function getSmallImage(imageUris: unknown): string | null {
  if (!imageUris || typeof imageUris !== 'object') {
    return null;
  }
  const maybeSmall = (imageUris as Record<string, unknown>).small;
  return typeof maybeSmall === 'string' ? maybeSmall : null;
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
  const [savingCards, setSavingCards] = useState(false);

  const [bulkText, setBulkText] = useState('');
  const [bulkUnresolved, setBulkUnresolved] = useState<string[]>([]);
  const [bulkAddedCount, setBulkAddedCount] = useState(0);
  const [importing, setImporting] = useState(false);

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

  useEffect(() => {
    if (!phaseOptions.includes(phaseLabel)) {
      setPhaseLabel(phaseOptions[0]);
    }
  }, [phaseLabel, phaseOptions]);

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

  const acquisitionsByPhase = useMemo(() => {
    const phaseGroups = new Map<string, Map<string, PhaseGroupedCard>>();

    for (const acquisition of acquisitions) {
      const phaseLabel = acquisition.phaseLabel;
      const groupedCards = phaseGroups.get(phaseLabel) ?? new Map<string, PhaseGroupedCard>();

      for (const entry of acquisition.entries) {
        const name = entry.cachedCard.name.trim();
        if (!name) {
          continue;
        }

        const normalizedName = name.toLowerCase();
        const existingGroup = groupedCards.get(normalizedName);
        if (existingGroup) {
          existingGroup.quantity += entry.quantity;
          if (!existingGroup.setCodes.includes(entry.cachedCard.setCode)) {
            existingGroup.setCodes.push(entry.cachedCard.setCode);
          }
          continue;
        }

        groupedCards.set(normalizedName, {
          key: normalizedName,
          name,
          quantity: entry.quantity,
          setCodes: [entry.cachedCard.setCode],
          manaCost: entry.cachedCard.manaCost,
          imageUri: getSmallImage(entry.cachedCard.imageUris),
        });
      }

      phaseGroups.set(phaseLabel, groupedCards);
    }

    return [...phaseGroups.entries()].map(([phaseLabel, groupedCards]) => [
      phaseLabel,
      [...groupedCards.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    ] as const);
  }, [acquisitions]);

  const addSearchResultToStage = (card: SearchResult) => {
    setSuccess(null);
    setError(null);
    setBulkUnresolved([]);
    setBulkAddedCount(0);

    const quantity = 1;
    const imageUri = getSmallImage(card.imageUris);
    setStagedCards((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.cachedCardId === card.scryfallId);
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
  };

  const updateStagedQuantity = (cachedCardId: string, quantity: number) => {
    setStagedCards((prev) =>
      prev.map((entry) => (entry.cachedCardId === cachedCardId ? { ...entry, quantity } : entry)),
    );
  };

  const removeStagedCard = (cachedCardId: string) => {
    setStagedCards((prev) => prev.filter((entry) => entry.cachedCardId !== cachedCardId));
  };

  const saveStagedCards = async (event: FormEvent) => {
    event.preventDefault();
    if (!poolId || stagedCards.length === 0) {
      return;
    }

    setSavingCards(true);
    setError(null);
    setSuccess(null);
    setBulkUnresolved([]);
    setBulkAddedCount(0);

    try {
      await apiRequest<CreateAcquisitionResponse>(`/api/card-pools/${poolId}/acquisitions`, {
        method: 'POST',
        body: {
          phaseLabel,
          cards: stagedCards.map((card) => ({
            cachedCardId: card.cachedCardId,
            quantity: card.quantity,
          })),
        },
      });
      setStagedCards([]);
      setSearchQuery('');
      setSearchResults([]);
      setSuccess('Cards added to pool.');
      await loadPool();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Unable to add cards');
    } finally {
      setSavingCards(false);
    }
  };

  const importBulkCards = async (event: FormEvent) => {
    event.preventDefault();
    if (!poolId) {
      return;
    }

    const items = parseBulkItems(bulkText);
    if (items.length === 0) {
      setError('Enter at least one card name to import.');
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);
    setBulkUnresolved([]);
    setBulkAddedCount(0);

    try {
      const response = await apiRequest<BulkResponse>(`/api/card-pools/${poolId}/acquisitions/bulk`, {
        method: 'POST',
        body: {
          phaseLabel,
          items,
        },
      });

      const addedCount =
        response.data.acquisition?.entries.reduce((sum, entry) => sum + entry.quantity, 0) ?? 0;
      setBulkAddedCount(addedCount);
      setBulkUnresolved(response.data.unresolved);
      setSuccess(addedCount > 0 ? `Imported ${addedCount} cards.` : 'No cards imported.');
      setBulkText('');
      await loadPool();
    } catch (importError) {
      setError(importError instanceof ApiError ? importError.message : 'Unable to import cards');
    } finally {
      setImporting(false);
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
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Booster Product</p>
          <p className="font-medium">
            {pool.boosterProduct.name} ({pool.boosterProduct.boosterType})
          </p>
          <p className="text-xs text-muted-foreground">
            Sets: {pool.boosterProduct.setCodes.map((setCode) => setCode.setCode).join(', ') || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Cards</p>
          <p className="text-2xl font-bold">{totalCards}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Acquisitions</h2>
        {acquisitions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No cards added yet{isOwner ? '. Use search or bulk import below to add cards.' : '.'}
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {acquisitionsByPhase.map(([phase, cards]) => (
              <div key={phase} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phase}</h3>
                <div className="rounded-md border border-border p-3">
                  <div className="space-y-2">
                    {cards.map((card) => (
                      <div key={card.key} className="flex items-center justify-between rounded-md border border-border p-2">
                        <div className="flex items-center gap-3">
                          {card.imageUri ? (
                            <img src={card.imageUri} alt={card.name} className="h-10 w-8 rounded border border-border object-cover" />
                          ) : null}
                          <div>
                            <p className="text-sm font-medium">{card.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {card.setCodes.join(', ')} {card.manaCost ? `- ${card.manaCost}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="rounded bg-muted px-2 py-1 text-xs font-semibold">x{card.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner ? (
        <>
          <form className="rounded-lg border border-border bg-card p-6 space-y-4" onSubmit={saveStagedCards}>
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
                        <p className="text-xs text-muted-foreground">
                          {card.setCode} {card.manaCost ? `- ${card.manaCost}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">Add</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium">Staged Cards</p>
              {stagedCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cards staged yet.</p>
              ) : (
                <div className="space-y-2">
                  {stagedCards.map((card) => (
                    <div key={card.cachedCardId} className="flex items-center justify-between gap-3 rounded border p-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{card.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {card.setCode} {card.manaCost ? `- ${card.manaCost}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={card.quantity}
                          onChange={(event) =>
                            updateStagedQuantity(card.cachedCardId, Math.max(1, Number(event.target.value) || 1))
                          }
                          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                          onClick={() => removeStagedCard(card.cachedCardId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={savingCards || stagedCards.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {savingCards ? 'Saving...' : 'Save to Pool'}
            </button>
          </form>

          <form className="rounded-lg border border-border bg-card p-6 space-y-4" onSubmit={importBulkCards}>
            <h2 className="text-lg font-semibold">Bulk Import</h2>
            <p className="text-sm text-muted-foreground">
              Paste one card name per line. You can prefix with a quantity, e.g. "2 Lightning Bolt".
            </p>
            <textarea
              className="min-h-40 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={'Island\n2 Lightning Bolt\nCounterspell'}
            />
            <button
              type="submit"
              disabled={importing}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>

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
          </form>
        </>
      ) : null}
    </div>
  );
}
