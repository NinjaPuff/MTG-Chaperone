import { beforeEach, describe, expect, it } from 'vitest';
import type { DeckSharePayload } from '@mtg-league/shared';
import { AppError } from '../../middleware/errorHandler.js';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { hashShareContents, resolveMintSharePayload } from '../../lib/decklistSharePayload.js';
import { createDecklistShareService } from '../../services/decklistShareService.js';

const shockCached = {
  scryfallId: 'shock-1',
  name: 'Shock',
  layout: 'normal',
  manaCost: '{R}',
  typeLine: 'Instant',
  cmc: 1,
  colorIdentity: ['R'],
  setCode: 'M10',
  collectorNumber: '146',
};

const negateCached = {
  scryfallId: 'negate-1',
  name: 'Negate',
  layout: 'normal',
  manaCost: '{1}{U}',
  typeLine: 'Instant',
  cmc: 2,
  colorIdentity: ['U'],
  setCode: 'M11',
  collectorNumber: '68',
};

const shockLiveEntry = {
  cachedCardId: 'shock-1',
  quantity: 2,
  zone: 'main' as const,
  cachedCard: shockCached,
};

const negateLiveEntry = {
  cachedCardId: 'negate-1',
  quantity: 1,
  zone: 'main' as const,
  cachedCard: negateCached,
};

const payload: DeckSharePayload = {
  v: 1,
  ownerDisplayName: 'Eve',
  deckName: 'Deck 1',
  eventName: 'Week 1',
  roundNumber: 1,
  status: 'draft',
  entries: [
    {
      scryfallId: 'shock-1',
      quantity: 2,
      zone: 'main',
      name: 'Shock',
      layout: 'normal',
      manaCost: '{R}',
      typeLine: 'Instant',
      cmc: 1,
      colorIdentity: ['R'],
    },
  ],
};

const crafted: DeckSharePayload = {
  v: 1,
  ownerDisplayName: 'Charlie',
  deckName: 'Hijacked',
  eventName: 'Fake',
  roundNumber: 99,
  status: 'locked',
  entries: [
    {
      scryfallId: 'negate-1',
      quantity: 1,
      zone: 'main',
      name: 'Negate',
      layout: 'normal',
      manaCost: '{1}{U}',
      typeLine: 'Instant',
      cmc: 2,
      colorIdentity: ['U'],
    },
  ],
};

const owner = { id: 'user-alice', displayName: 'Alice', publicName: null, role: 'user' as const };
const charlie = { id: 'user-charlie', displayName: 'Charlie', publicName: null, role: 'user' as const };
const admin = { id: 'user-admin', displayName: 'Admin', publicName: null, role: 'admin' as const };

const visibleAliceDeck = {
  id: 'deck-1',
  userId: 'user-alice',
  name: 'Deck 1',
  orderIndex: 0,
  status: 'submitted' as const,
  user: { displayName: 'Alice', publicName: null },
  event: {
    status: 'completed' as const,
    name: 'Week 1',
    season: { poolVisibility: true, decklistVisibility: true, scheduleVisibility: true },
  },
  round: { status: 'completed' as const, roundNumber: 1 },
  entries: [shockLiveEntry],
};

const leftoverArchiveDraft = {
  ...visibleAliceDeck,
  status: 'draft' as const,
};

const hiddenAliceDraft = {
  ...visibleAliceDeck,
  status: 'draft' as const,
  entries: [negateLiveEntry],
  event: {
    ...visibleAliceDeck.event,
    status: 'active' as const,
  },
  round: {
    ...visibleAliceDeck.round,
    status: 'in_progress' as const,
  },
};

const expectedSelect = {
  id: true,
  userId: true,
  name: true,
  orderIndex: true,
  status: true,
  user: { select: { displayName: true, publicName: true } },
  event: {
    select: {
      status: true,
      name: true,
      season: {
        select: { poolVisibility: true, decklistVisibility: true, scheduleVisibility: true },
      },
    },
  },
  round: { select: { status: true, roundNumber: true } },
  entries: {
    include: {
      cachedCard: {
        select: {
          scryfallId: true,
          name: true,
          layout: true,
          manaCost: true,
          typeLine: true,
          cmc: true,
          colorIdentity: true,
          setCode: true,
          collectorNumber: true,
        },
      },
    },
  },
};

function liveFromDeck(deck: typeof visibleAliceDeck) {
  return {
    name: deck.name,
    orderIndex: deck.orderIndex,
    status: deck.status,
    eventName: deck.event.name,
    roundNumber: deck.round.roundNumber,
    ownerDisplayName: deck.user.publicName || deck.user.displayName,
    entries: deck.entries,
  };
}

function expectedPayload(
  deck: typeof visibleAliceDeck,
  viewerIsOwner: boolean,
  clientPayload: DeckSharePayload,
) {
  return resolveMintSharePayload({
    viewerIsOwner,
    clientPayload,
    live: liveFromDeck(deck),
  });
}

function getAppError(fn: () => Promise<unknown>) {
  return fn().then(
    () => {
      throw new Error('Expected AppError to be thrown');
    },
    (error) => {
      if (!(error instanceof AppError)) {
        throw error;
      }
      return error;
    },
  );
}

describe('decklistShareService', () => {
  const service = createDecklistShareService({
    prisma: prismaMock as never,
    generateShareToken: () => 'tok_test',
  });

  beforeEach(() => {
    resetPrismaMock();
    prismaMock.decklist.findUnique.mockResolvedValue(visibleAliceDeck);
    prismaMock.decklistShare.findUnique.mockResolvedValue(null);
    prismaMock.decklistShare.create.mockResolvedValue({
      id: 'share-1',
      token: 'tok_test',
      contentsHash: 'pending',
      payload: {},
      createdById: 'user-alice',
      decklistId: 'deck-1',
    });
  });

  it('mints a token for the owner and stamps ownerDisplayName from the deck owner', async () => {
    const stored = expectedPayload(visibleAliceDeck, true, payload);
    const result = await service.createDecklistShare({
      user: owner,
      decklistId: 'deck-1',
      payload,
    });

    expect(result).toEqual({ token: 'tok_test' });
    expect(stored.status).toBe('submitted');
    expect(stored.eventName).toBe('Week 1');
    expect(stored.roundNumber).toBe(1);
    expect(stored.ownerDisplayName).toBe('Alice');
    expect(prismaMock.decklistShare.create).toHaveBeenCalledWith({
      data: {
        token: 'tok_test',
        contentsHash: hashShareContents(stored, 'deck-1'),
        payload: stored,
        createdById: 'user-alice',
        decklistId: 'deck-1',
      },
    });
    expect(prismaMock.decklist.findUnique).toHaveBeenCalledWith({
      where: { id: 'deck-1' },
      select: expectedSelect,
    });
  });

  it('reuses the existing token when the same owner shares an unchanged list', async () => {
    prismaMock.decklistShare.findUnique.mockResolvedValue({ token: 'tok_existing' });

    const result = await service.createDecklistShare({
      user: owner,
      decklistId: 'deck-1',
      payload,
    });

    expect(result).toEqual({ token: 'tok_existing' });
    expect(prismaMock.decklistShare.create).not.toHaveBeenCalled();
    expect(prismaMock.decklistShare.findUnique).toHaveBeenCalledWith({
      where: {
        createdById_contentsHash: {
          createdById: 'user-alice',
          contentsHash: hashShareContents(expectedPayload(visibleAliceDeck, true, payload), 'deck-1'),
        },
      },
      select: { token: true },
    });
  });

  it('lets another player mint a visible list and stamps the deck owner’s name', async () => {
    const stored = expectedPayload(visibleAliceDeck, false, crafted);
    const result = await service.createDecklistShare({
      user: charlie,
      decklistId: 'deck-1',
      payload: crafted,
    });

    expect(result).toEqual({ token: 'tok_test' });
    expect(prismaMock.decklistShare.create).toHaveBeenCalledWith({
      data: {
        token: 'tok_test',
        contentsHash: hashShareContents(stored, 'deck-1'),
        payload: stored,
        createdById: 'user-charlie',
        decklistId: 'deck-1',
      },
    });
    expect(stored.entries[0]).toMatchObject({
      scryfallId: 'shock-1',
      setCode: 'M10',
      collectorNumber: '146',
    });
    expect(stored.deckName).toBe('Deck 1');
    expect(stored.eventName).toBe('Week 1');
    expect(stored.roundNumber).toBe(1);
    expect(stored.status).toBe('submitted');
    expect(stored.ownerDisplayName).toBe('Alice');
  });

  it('owner mint freezes unsaved client entries and stamps live event metadata', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(hiddenAliceDraft);
    const unsaved: DeckSharePayload = {
      ...payload,
      deckName: 'Unsaved',
      eventName: '',
      status: 'submitted',
      entries: [
        {
          scryfallId: 'shock-1',
          quantity: 2,
          zone: 'main',
          name: 'Shock',
          layout: 'normal',
          manaCost: '{R}',
          typeLine: 'Instant',
          cmc: 1,
          colorIdentity: ['R'],
          setCode: 'M10',
          collectorNumber: '146',
        },
      ],
    };
    const stored = expectedPayload(hiddenAliceDraft, true, unsaved);

    await service.createDecklistShare({
      user: owner,
      decklistId: 'deck-1',
      payload: unsaved,
    });

    expect(stored.entries[0]).toMatchObject({ scryfallId: 'shock-1', setCode: 'M10' });
    expect(stored.deckName).toBe('Unsaved');
    expect(stored.eventName).toBe('Week 1');
    expect(stored.status).toBe('draft');
    expect(stored.ownerDisplayName).toBe('Alice');
    expect(prismaMock.decklistShare.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ payload: stored }),
    });
  });

  it('admin mint of another player’s list uses live entries', async () => {
    const stored = expectedPayload(visibleAliceDeck, false, crafted);
    await service.createDecklistShare({
      user: admin,
      decklistId: 'deck-1',
      payload: crafted,
    });

    expect(prismaMock.decklistShare.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdById: 'user-admin',
        payload: stored,
      }),
    });
    expect(stored.entries[0]).toMatchObject({ scryfallId: 'shock-1' });
  });

  it('admin mint of a leftover archive draft uses live entries', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(leftoverArchiveDraft);
    const stored = expectedPayload(leftoverArchiveDraft, false, crafted);

    const result = await service.createDecklistShare({
      user: admin,
      decklistId: 'deck-1',
      payload: crafted,
    });

    expect(result).toEqual({ token: 'tok_test' });
    expect(prismaMock.decklistShare.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ payload: stored, createdById: 'user-admin' }),
    });
    expect(stored.entries[0]).toMatchObject({ scryfallId: 'shock-1' });
  });

  it('returns 403 FORBIDDEN when a non-owner tries to mint a leftover archive draft', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(leftoverArchiveDraft);

    const error = await getAppError(() =>
      service.createDecklistShare({
        user: charlie,
        decklistId: 'deck-1',
        payload,
      }),
    );

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(prismaMock.decklistShare.create).not.toHaveBeenCalled();
  });

  it('lets the owner mint a leftover archive draft', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(leftoverArchiveDraft);

    const result = await service.createDecklistShare({
      user: owner,
      decklistId: 'deck-1',
      payload,
    });

    expect(result).toEqual({ token: 'tok_test' });
    expect(prismaMock.decklistShare.create).toHaveBeenCalled();
  });

  it('returns 403 FORBIDDEN when a non-owner tries to mint a hidden current-round draft', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(hiddenAliceDraft);

    const error = await getAppError(() =>
      service.createDecklistShare({
        user: charlie,
        decklistId: 'deck-1',
        payload,
      }),
    );

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(prismaMock.decklistShare.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the decklist is missing', async () => {
    prismaMock.decklist.findUnique.mockResolvedValue(null);

    const error = await getAppError(() =>
      service.createDecklistShare({
        user: owner,
        decklistId: 'missing',
        payload,
      }),
    );

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(prismaMock.decklistShare.create).not.toHaveBeenCalled();
  });

  it('returns the stored payload by token without loading a live decklist', async () => {
    const stored = expectedPayload(visibleAliceDeck, true, payload);
    prismaMock.decklistShare.findUnique.mockResolvedValue({ payload: stored });

    const result = await service.getDecklistShare('tok_test');

    expect(result).toEqual(stored);
    expect(prismaMock.decklistShare.findUnique).toHaveBeenCalledWith({
      where: { token: 'tok_test' },
      select: { payload: true },
    });
    expect(prismaMock.decklist.findUnique).not.toHaveBeenCalled();
  });

  it('Charlie sharing Alice then Bob with identical metadata and cards does not reuse Alice’s token', async () => {
    const bobDeck = {
      ...visibleAliceDeck,
      id: 'deck-bob',
      userId: 'user-bob',
      user: { displayName: 'Bob', publicName: null },
    };
    prismaMock.decklist.findUnique
      .mockResolvedValueOnce(visibleAliceDeck)
      .mockResolvedValueOnce(bobDeck);

    await service.createDecklistShare({
      user: charlie,
      decklistId: 'deck-1',
      payload: crafted,
    });
    await service.createDecklistShare({
      user: charlie,
      decklistId: 'deck-bob',
      payload: crafted,
    });

    expect(prismaMock.decklistShare.create).toHaveBeenCalledTimes(2);
    const firstCreate = prismaMock.decklistShare.create.mock.calls[0]?.[0] as {
      data: { decklistId: string; contentsHash: string };
    };
    const secondCreate = prismaMock.decklistShare.create.mock.calls[1]?.[0] as {
      data: { decklistId: string; contentsHash: string };
    };
    expect(firstCreate.data.decklistId).toBe('deck-1');
    expect(secondCreate.data.decklistId).toBe('deck-bob');
    expect(firstCreate.data.contentsHash).not.toBe(secondCreate.data.contentsHash);
  });

  it('owner remint with client eventName empty reuses token when live event name matches', async () => {
    const emptyEvent: DeckSharePayload = { ...payload, eventName: '' };
    prismaMock.decklistShare.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ token: 'tok_existing' });

    const first = await service.createDecklistShare({
      user: owner,
      decklistId: 'deck-1',
      payload: emptyEvent,
    });
    expect(first).toEqual({ token: 'tok_test' });
    expect(prismaMock.decklistShare.create).toHaveBeenCalledTimes(1);

    const second = await service.createDecklistShare({
      user: owner,
      decklistId: 'deck-1',
      payload: emptyEvent,
    });
    expect(second).toEqual({ token: 'tok_existing' });
    expect(prismaMock.decklistShare.create).toHaveBeenCalledTimes(1);
  });

  it('returns 404 INVALID_SHARE for an unknown token', async () => {
    prismaMock.decklistShare.findUnique.mockResolvedValue(null);

    const error = await getAppError(() => service.getDecklistShare('nope'));

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('INVALID_SHARE');
    expect(prismaMock.decklist.findUnique).not.toHaveBeenCalled();
  });
});
