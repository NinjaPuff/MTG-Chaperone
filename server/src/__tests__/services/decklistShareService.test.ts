import { beforeEach, describe, expect, it } from 'vitest';
import type { DeckSharePayload } from '@mtg-league/shared';
import { AppError } from '../../middleware/errorHandler.js';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { hashShareContents, stampShareOwner } from '../../lib/decklistSharePayload.js';
import { createDecklistShareService } from '../../services/decklistShareService.js';

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

const owner = { id: 'user-alice', displayName: 'Alice', publicName: null, role: 'user' as const };
const charlie = { id: 'user-charlie', displayName: 'Charlie', publicName: null, role: 'user' as const };
const stamped = stampShareOwner(payload, 'Alice');
const contentsHash = hashShareContents(stamped);

const visibleAliceDeck = {
  id: 'deck-1',
  userId: 'user-alice',
  status: 'submitted' as const,
  user: { displayName: 'Alice', publicName: null },
  event: {
    status: 'completed' as const,
    season: { poolVisibility: true, decklistVisibility: true, scheduleVisibility: true },
  },
  round: { status: 'completed' as const },
};

const leftoverArchiveDraft = {
  ...visibleAliceDeck,
  status: 'draft' as const,
};

const hiddenAliceDraft = {
  ...visibleAliceDeck,
  status: 'draft' as const,
  event: {
    status: 'active' as const,
    season: { poolVisibility: true, decklistVisibility: true, scheduleVisibility: true },
  },
  round: { status: 'in_progress' as const },
};

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
      contentsHash,
      payload: stamped,
      createdById: 'user-alice',
      decklistId: 'deck-1',
    });
  });

  it('mints a token for the owner and stamps ownerDisplayName from the deck owner', async () => {
    const result = await service.createDecklistShare({
      user: owner,
      decklistId: 'deck-1',
      payload,
    });

    expect(result).toEqual({ token: 'tok_test' });
    expect(prismaMock.decklistShare.create).toHaveBeenCalledWith({
      data: {
        token: 'tok_test',
        contentsHash,
        payload: stamped,
        createdById: 'user-alice',
        decklistId: 'deck-1',
      },
    });
    expect(prismaMock.decklist.findUnique).toHaveBeenCalledWith({
      where: { id: 'deck-1' },
      select: {
        id: true,
        userId: true,
        status: true,
        user: { select: { displayName: true, publicName: true } },
        event: {
          select: {
            status: true,
            season: {
              select: { poolVisibility: true, decklistVisibility: true, scheduleVisibility: true },
            },
          },
        },
        round: { select: { status: true } },
      },
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
          contentsHash,
        },
      },
      select: { token: true },
    });
  });

  it('lets another player mint a visible list and stamps the deck owner’s name', async () => {
    const result = await service.createDecklistShare({
      user: charlie,
      decklistId: 'deck-1',
      payload,
    });

    expect(result).toEqual({ token: 'tok_test' });
    expect(prismaMock.decklistShare.create).toHaveBeenCalledWith({
      data: {
        token: 'tok_test',
        contentsHash,
        payload: stamped,
        createdById: 'user-charlie',
        decklistId: 'deck-1',
      },
    });
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
    prismaMock.decklistShare.findUnique.mockResolvedValue({ payload: stamped });

    const result = await service.getDecklistShare('tok_test');

    expect(result).toEqual(stamped);
    expect(prismaMock.decklistShare.findUnique).toHaveBeenCalledWith({
      where: { token: 'tok_test' },
      select: { payload: true },
    });
    expect(prismaMock.decklist.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 INVALID_SHARE for an unknown token', async () => {
    prismaMock.decklistShare.findUnique.mockResolvedValue(null);

    const error = await getAppError(() => service.getDecklistShare('nope'));

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('INVALID_SHARE');
    expect(prismaMock.decklist.findUnique).not.toHaveBeenCalled();
  });
});
