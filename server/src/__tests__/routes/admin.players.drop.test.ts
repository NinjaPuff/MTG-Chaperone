import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const dropMocks = vi.hoisted(() => ({
  dropPlayer: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
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
    requireAdmin: (req: any, _res: any, next: any) => {
      if (req.user?.role !== 'admin') {
        next(new AppError(403, 'FORBIDDEN', 'Admin access required'));
        return;
      }
      next();
    },
  };
});

vi.mock('../../services/playerDropService.js', () => ({
  dropPlayer: dropMocks.dropPlayer,
}));

// Unused by this route but imported by admin.ts.
vi.mock('../../services/scryfallService.js', () => ({
  getSetCacheStats: vi.fn(),
  importSetFromScryfall: vi.fn(),
  bulkImportSet: vi.fn(),
  searchCards: vi.fn(),
  bulkLookupByName: vi.fn(),
  getCard: vi.fn(),
  getCardFaces: vi.fn(),
  lookupCanonicalByName: vi.fn(),
}));

vi.mock('../../services/boosterProductService.js', () => ({
  getBoosterProduct: vi.fn(),
  createBoosterProduct: vi.fn(),
  deleteBoosterProduct: vi.fn(),
  listBoosterProducts: vi.fn(),
  updateBoosterProduct: vi.fn(),
}));

vi.mock('../../services/cardCacheService.js', () => ({
  clearAndImportSet: vi.fn(),
  resolveStaleReferences: vi.fn(),
}));

import app from '../../index.js';

describe('admin drop player route', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const seasonId = '22222222-2222-4222-8222-222222222222';
  const eventId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    dropMocks.dropPlayer.mockReset();
    dropMocks.dropPlayer.mockResolvedValue({ droppedFrom: 'event', affectedMatches: 2 });
  });

  it('returns 403 when not admin', async () => {
    const response = await request(app)
      .post(`/api/admin/players/${userId}/drop`)
      .set('x-test-role', 'user')
      .send({ seasonId });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(dropMocks.dropPlayer).not.toHaveBeenCalled();
  });

  it('returns 400 when seasonId is missing', async () => {
    const response = await request(app)
      .post(`/api/admin/players/${userId}/drop`)
      .set('x-test-role', 'admin')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(dropMocks.dropPlayer).not.toHaveBeenCalled();
  });

  it('returns 200 with droppedFrom event when eventId is set', async () => {
    dropMocks.dropPlayer.mockResolvedValue({ droppedFrom: 'event', affectedMatches: 2 });

    const response = await request(app)
      .post(`/api/admin/players/${userId}/drop`)
      .set('x-test-role', 'admin')
      .set('x-test-user', 'admin-42')
      .send({
        seasonId,
        eventId,
        reason: 'Requested by player',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      droppedFrom: 'event',
      affectedMatches: 2,
    });
    expect(dropMocks.dropPlayer).toHaveBeenCalledWith({
      userId,
      seasonId,
      eventId,
      reason: 'Requested by player',
      droppedById: 'admin-42',
    });
  });

  it('returns 200 with droppedFrom season when eventId is omitted', async () => {
    dropMocks.dropPlayer.mockResolvedValue({ droppedFrom: 'season', affectedMatches: 5 });

    const response = await request(app)
      .post(`/api/admin/players/${userId}/drop`)
      .set('x-test-role', 'admin')
      .set('x-test-user', 'admin-99')
      .send({
        seasonId,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      droppedFrom: 'season',
      affectedMatches: 5,
    });
    expect(dropMocks.dropPlayer).toHaveBeenCalledWith({
      userId,
      seasonId,
      eventId: undefined,
      reason: undefined,
      droppedById: 'admin-99',
    });
  });
});
