import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  adjustCardQuantityInPhase: vi.fn(),
  bulkResolveAcquisitionItems: vi.fn(),
  clearPhaseAcquisitions: vi.fn(),
  getPoolDetail: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../middleware/auth.js', () => ({
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
}));

vi.mock('../../services/cardPoolService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/cardPoolService.js')>();
  return {
    ...actual,
    adjustCardQuantityInPhase: mocks.adjustCardQuantityInPhase,
    bulkResolveAcquisitionItems: mocks.bulkResolveAcquisitionItems,
    clearPhaseAcquisitions: mocks.clearPhaseAcquisitions,
    getPoolDetail: mocks.getPoolDetail,
  };
});

import app from '../../index.js';

describe('card pools routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.adjustCardQuantityInPhase.mockReset();
    mocks.bulkResolveAcquisitionItems.mockReset();
    mocks.clearPhaseAcquisitions.mockReset();
    mocks.getPoolDetail.mockReset();
    mocks.getPoolDetail.mockResolvedValue({
      user: { id: 'owner-1' },
      boosterProduct: { setCodes: [] },
    });
  });

  it('allows admins to adjust a pool they do not own', async () => {
    mocks.adjustCardQuantityInPhase.mockResolvedValue(undefined);

    const response = await request(app)
      .patch('/api/card-pools/pool-1/cards/adjust')
      .set('x-test-user', 'admin-1')
      .set('x-test-role', 'admin')
      .send({
        phaseLabel: 'After Round 2',
        cachedCardId: 'card-1',
        action: 'remove_one',
      });

    expect(response.status).toBe(204);
    expect(mocks.adjustCardQuantityInPhase).toHaveBeenCalledWith('pool-1', 'After Round 2', 'card-1', 'remove_one');
  });

  it('rejects non-admin users editing someone else pool', async () => {
    const response = await request(app)
      .patch('/api/card-pools/pool-1/cards/adjust')
      .set('x-test-user', 'user-2')
      .set('x-test-role', 'user')
      .send({
        phaseLabel: 'After Round 2',
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
        phaseLabel: 'After Round 2',
      });

    expect(response.status).toBe(204);
    expect(mocks.clearPhaseAcquisitions).toHaveBeenCalledWith('pool-1', 'After Round 2');
  });

  it('rejects non-admin users clearing a phase', async () => {
    const response = await request(app)
      .delete('/api/card-pools/pool-1/phases')
      .set('x-test-user', 'owner-1')
      .set('x-test-role', 'user')
      .send({
        phaseLabel: 'After Round 2',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.clearPhaseAcquisitions).not.toHaveBeenCalled();
  });

  it('allows pool owners to bulk resolve acquisitions', async () => {
    mocks.getPoolDetail.mockResolvedValue({
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
        phaseLabel: 'Initial Pool',
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
        phaseLabel: 'Initial Pool',
        items: [{ name: 'Lightning Bolt', quantity: 1 }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.bulkResolveAcquisitionItems).not.toHaveBeenCalled();
  });
});
