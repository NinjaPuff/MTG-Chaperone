import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  adjustCardQuantityInPhase: vi.fn(),
  bulkResolveAcquisitionItems: vi.fn(),
  clearPhaseAcquisitions: vi.fn(),
  createAcquisition: vi.fn(),
  deleteAcquisition: vi.fn(),
  getPoolDetail: vi.fn(),
  listAcquisitions: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../middleware/auth.js', async () => {
  const { mockOptionalAuth } = await import('../helpers/mockOptionalAuth.js');
  return {
    optionalAuth: mockOptionalAuth,
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = {
        id: req.headers['x-test-user'] ?? 'user-1',
        displayName: 'Test User',
        slug: 'test-user',
        avatarUrl: null,
        role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'user',
      };
      next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../services/cardPoolService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/cardPoolService.js')>();
  return {
    ...actual,
    adjustCardQuantityInPhase: mocks.adjustCardQuantityInPhase,
    bulkResolveAcquisitionItems: mocks.bulkResolveAcquisitionItems,
    clearPhaseAcquisitions: mocks.clearPhaseAcquisitions,
    createAcquisition: mocks.createAcquisition,
    deleteAcquisition: mocks.deleteAcquisition,
    getPoolDetail: mocks.getPoolDetail,
    listAcquisitions: mocks.listAcquisitions,
  };
});

import app from '../../index.js';

describe('card pools routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.adjustCardQuantityInPhase.mockReset();
    mocks.bulkResolveAcquisitionItems.mockReset();
    mocks.clearPhaseAcquisitions.mockReset();
    mocks.createAcquisition.mockReset();
    mocks.deleteAcquisition.mockReset();
    mocks.getPoolDetail.mockReset();
    mocks.listAcquisitions.mockReset();
    mocks.getPoolDetail.mockResolvedValue({
      seasonId: 'season-1',
      user: { id: 'owner-1' },
      boosterProduct: { setCodes: [] },
    });
    prismaMock.event.findMany.mockResolvedValue([{ status: 'active' }]);
  });

  it('allows admins to adjust a pool they do not own', async () => {
    mocks.adjustCardQuantityInPhase.mockResolvedValue(undefined);

    const response = await request(app)
      .patch('/api/card-pools/pool-1/cards/adjust')
      .set('x-test-user', 'admin-1')
      .set('x-test-role', 'admin')
      .send({
        phaseLabel: 'Phase 3',
        cachedCardId: 'card-1',
        action: 'remove_one',
      });

    expect(response.status).toBe(204);
    expect(mocks.adjustCardQuantityInPhase).toHaveBeenCalledWith('pool-1', 'Phase 3', 'card-1', 'remove_one');
  });

  it('rejects non-admin users editing someone else pool', async () => {
    const response = await request(app)
      .patch('/api/card-pools/pool-1/cards/adjust')
      .set('x-test-user', 'user-2')
      .set('x-test-role', 'user')
      .send({
        phaseLabel: 'Phase 3',
        cachedCardId: 'card-1',
        action: 'add',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.adjustCardQuantityInPhase).not.toHaveBeenCalled();
  });

  it('allows admins to clear an entire phase', async () => {
    mocks.clearPhaseAcquisitions.mockResolvedValue(undefined);

    const response = await request(app)
      .delete('/api/card-pools/pool-1/phases')
      .set('x-test-user', 'admin-1')
      .set('x-test-role', 'admin')
      .send({
        phaseLabel: 'Phase 3',
      });

    expect(response.status).toBe(204);
    expect(mocks.clearPhaseAcquisitions).toHaveBeenCalledWith('pool-1', 'Phase 3');
  });

  it('rejects non-admin users clearing a phase', async () => {
    const response = await request(app)
      .delete('/api/card-pools/pool-1/phases')
      .set('x-test-user', 'owner-1')
      .set('x-test-role', 'user')
      .send({
        phaseLabel: 'Phase 3',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.clearPhaseAcquisitions).not.toHaveBeenCalled();
  });

  it('allows pool owners to bulk resolve acquisitions', async () => {
    mocks.getPoolDetail.mockResolvedValue({
      seasonId: 'season-1',
      user: { id: 'owner-1' },
      boosterProduct: { setCodes: [{ setCode: 'ECL' }] },
    });
    mocks.bulkResolveAcquisitionItems.mockResolvedValue({
      resolved: [
        {
          cachedCardId: 'bolt-id',
          quantity: 1,
          cachedCard: {
            scryfallId: 'bolt-id',
            name: 'Lightning Bolt',
            setCode: 'ECL',
            imageUris: null,
            manaCost: '{R}',
          },
        },
      ],
      unresolved: [],
    });

    const response = await request(app)
      .post('/api/card-pools/pool-1/acquisitions/bulk')
      .set('x-test-user', 'owner-1')
      .set('x-test-role', 'user')
      .send({
        phaseLabel: 'Phase 1',
        items: [{ name: 'Lightning Bolt', quantity: 1 }],
      });

    expect(response.status).toBe(200);
    expect(mocks.bulkResolveAcquisitionItems).toHaveBeenCalledWith([{ name: 'Lightning Bolt', quantity: 1 }], ['ECL']);
    expect(response.body.data.resolved).toHaveLength(1);
    expect(response.body.data.unresolved).toEqual([]);
  });

  it('rejects non-owners bulk resolving someone else pool', async () => {
    const response = await request(app)
      .post('/api/card-pools/pool-1/acquisitions/bulk')
      .set('x-test-user', 'user-2')
      .set('x-test-role', 'user')
      .send({
        phaseLabel: 'Phase 1',
        items: [{ name: 'Lightning Bolt', quantity: 1 }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.bulkResolveAcquisitionItems).not.toHaveBeenCalled();
  });

  it('exports per-printing decklist lines with set and collector number', async () => {
    mocks.getPoolDetail.mockResolvedValue({
      userId: 'owner-1',
      seasonId: 'season-1',
      user: { id: 'owner-1', slug: 'owner-slug', displayName: 'Owner' },
      season: {
        id: 'season-1',
        number: 1,
        league: { slug: 'test-league', name: 'Test League' },
      },
      boosterProduct: { setCodes: [] },
    });
    prismaMock.season.findUnique.mockResolvedValue({
      poolVisibility: false,
      decklistVisibility: false,
      scheduleVisibility: false,
    });
    mocks.listAcquisitions.mockResolvedValue([
      {
        entries: [
          {
            quantity: 1,
            cachedCard: {
              scryfallId: 'bolt-ecl',
              name: 'Lightning Bolt',
              setCode: 'ECL',
              collectorNumber: '112',
            },
          },
          {
            quantity: 1,
            cachedCard: {
              scryfallId: 'bolt-mh2',
              name: 'Lightning Bolt',
              setCode: 'MH2',
              collectorNumber: '261',
            },
          },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/card-pools/pool-1/export/decklist')
      .set('x-test-user', 'owner-1')
      .set('x-test-role', 'user');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(mocks.listAcquisitions).toHaveBeenCalledWith('pool-1');
    expect(response.text).toContain('1 Lightning Bolt (ECL) 112');
    expect(response.text).toContain('1 Lightning Bolt (MH2) 261');
  });

  describe('season-locked pool', () => {
    const lockedEvents = [{ status: 'completed' }, { status: 'completed' }];
    const unlockedEvents = [{ status: 'completed' }, { status: 'active' }];

    beforeEach(() => {
      mocks.getPoolDetail.mockResolvedValue({
        seasonId: 'season-1',
        user: { id: 'owner-1' },
        boosterProduct: { setCodes: [{ setCode: 'ECL' }] },
      });
    });

    describe('POST /acquisitions', () => {
      it('blocks the pool owner when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 1',
            cards: [{ cachedCardId: 'card-1', quantity: 1 }],
          });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('SEASON_LOCKED');
        expect(mocks.createAcquisition).not.toHaveBeenCalled();
      });

      it('allows admins when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);
        mocks.createAcquisition.mockResolvedValue({ id: 'acq-1' });

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions')
          .set('x-test-user', 'admin-1')
          .set('x-test-role', 'admin')
          .send({
            phaseLabel: 'Phase 1',
            cards: [{ cachedCardId: 'card-1', quantity: 1 }],
          });

        expect(response.status).toBe(201);
        expect(mocks.createAcquisition).toHaveBeenCalled();
      });

      it('allows the pool owner when the season is not locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);
        mocks.createAcquisition.mockResolvedValue({ id: 'acq-1' });

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 2',
            cards: [{ cachedCardId: 'card-1', quantity: 1 }],
          });

        expect(response.status).toBe(201);
        expect(mocks.createAcquisition).toHaveBeenCalled();
      });

      it('blocks the pool owner from adding to a non-current phase', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 1',
            cards: [{ cachedCardId: 'card-1', quantity: 1 }],
          });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('PHASE_NOT_ALLOWED');
        expect(mocks.createAcquisition).not.toHaveBeenCalled();
      });

      it('allows the pool owner to add to the next window', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);
        mocks.createAcquisition.mockResolvedValue({ id: 'acq-1' });

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 3',
            cards: [{ cachedCardId: 'card-1', quantity: 1 }],
          });

        expect(response.status).toBe(201);
        expect(mocks.createAcquisition).toHaveBeenCalled();
      });
    });

    describe('POST /acquisitions/bulk', () => {
      it('blocks the pool owner when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions/bulk')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 1',
            items: [{ name: 'Lightning Bolt', quantity: 1 }],
          });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('SEASON_LOCKED');
        expect(mocks.bulkResolveAcquisitionItems).not.toHaveBeenCalled();
      });

      it('allows admins when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);
        mocks.bulkResolveAcquisitionItems.mockResolvedValue({ resolved: [], unresolved: [] });

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions/bulk')
          .set('x-test-user', 'admin-1')
          .set('x-test-role', 'admin')
          .send({
            phaseLabel: 'Phase 1',
            items: [{ name: 'Lightning Bolt', quantity: 1 }],
          });

        expect(response.status).toBe(200);
        expect(mocks.bulkResolveAcquisitionItems).toHaveBeenCalled();
      });

      it('allows the pool owner when the season is not locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);
        mocks.bulkResolveAcquisitionItems.mockResolvedValue({ resolved: [], unresolved: [] });

        const response = await request(app)
          .post('/api/card-pools/pool-1/acquisitions/bulk')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 1',
            items: [{ name: 'Lightning Bolt', quantity: 1 }],
          });

        expect(response.status).toBe(200);
        expect(mocks.bulkResolveAcquisitionItems).toHaveBeenCalled();
      });
    });

    describe('DELETE /acquisitions/:acqId', () => {
      it('blocks the pool owner when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);

        const response = await request(app)
          .delete('/api/card-pools/pool-1/acquisitions/acq-1')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user');

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('SEASON_LOCKED');
        expect(mocks.deleteAcquisition).not.toHaveBeenCalled();
      });

      it('allows admins when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);
        prismaMock.poolAcquisition.findUnique.mockResolvedValue({
          id: 'acq-1',
          cardPoolId: 'pool-1',
        });
        mocks.deleteAcquisition.mockResolvedValue(undefined);

        const response = await request(app)
          .delete('/api/card-pools/pool-1/acquisitions/acq-1')
          .set('x-test-user', 'admin-1')
          .set('x-test-role', 'admin');

        expect(response.status).toBe(204);
        expect(mocks.deleteAcquisition).toHaveBeenCalledWith('acq-1');
      });

      it('allows the pool owner when the season is not locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);
        prismaMock.poolAcquisition.findUnique.mockResolvedValue({
          id: 'acq-1',
          cardPoolId: 'pool-1',
        });
        mocks.deleteAcquisition.mockResolvedValue(undefined);

        const response = await request(app)
          .delete('/api/card-pools/pool-1/acquisitions/acq-1')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user');

        expect(response.status).toBe(204);
        expect(mocks.deleteAcquisition).toHaveBeenCalledWith('acq-1');
      });
    });

    describe('PATCH /cards/adjust', () => {
      it('blocks the pool owner when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);

        const response = await request(app)
          .patch('/api/card-pools/pool-1/cards/adjust')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 3',
            cachedCardId: 'card-1',
            action: 'add',
          });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('SEASON_LOCKED');
        expect(mocks.adjustCardQuantityInPhase).not.toHaveBeenCalled();
      });

      it('allows admins when the season is locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(lockedEvents);
        mocks.adjustCardQuantityInPhase.mockResolvedValue(undefined);

        const response = await request(app)
          .patch('/api/card-pools/pool-1/cards/adjust')
          .set('x-test-user', 'admin-1')
          .set('x-test-role', 'admin')
          .send({
            phaseLabel: 'Phase 3',
            cachedCardId: 'card-1',
            action: 'remove_one',
          });

        expect(response.status).toBe(204);
        expect(mocks.adjustCardQuantityInPhase).toHaveBeenCalled();
      });

      it('allows the pool owner when the season is not locked', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);
        mocks.adjustCardQuantityInPhase.mockResolvedValue(undefined);

        const response = await request(app)
          .patch('/api/card-pools/pool-1/cards/adjust')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 2',
            cachedCardId: 'card-1',
            action: 'add',
          });

        expect(response.status).toBe(204);
        expect(mocks.adjustCardQuantityInPhase).toHaveBeenCalled();
      });

      it('blocks the pool owner from adjusting a non-current phase', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);

        const response = await request(app)
          .patch('/api/card-pools/pool-1/cards/adjust')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 1',
            cachedCardId: 'card-1',
            action: 'add',
          });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('PHASE_NOT_ALLOWED');
        expect(mocks.adjustCardQuantityInPhase).not.toHaveBeenCalled();
      });

      it('allows the pool owner to adjust the next window', async () => {
        prismaMock.event.findMany.mockResolvedValue(unlockedEvents);
        mocks.adjustCardQuantityInPhase.mockResolvedValue(undefined);

        const response = await request(app)
          .patch('/api/card-pools/pool-1/cards/adjust')
          .set('x-test-user', 'owner-1')
          .set('x-test-role', 'user')
          .send({
            phaseLabel: 'Phase 3',
            cachedCardId: 'card-1',
            action: 'add',
          });

        expect(response.status).toBe(204);
        expect(mocks.adjustCardQuantityInPhase).toHaveBeenCalled();
      });
    });
  });
});
