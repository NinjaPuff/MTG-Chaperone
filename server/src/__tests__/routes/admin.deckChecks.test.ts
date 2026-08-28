import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const deckCheckMocks = vi.hoisted(() => ({
  getAdminDeckChecks: vi.fn(),
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

vi.mock('../../services/deckCheckService.js', () => ({
  getAdminDeckChecks: deckCheckMocks.getAdminDeckChecks,
}));

vi.mock('../../services/playerDropService.js', () => ({
  dropPlayer: vi.fn(),
}));

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

const serviceReturn = {
  emptyReason: null,
  season: { id: 'season-1', name: 'Season 1', decklistVisibility: false },
  event: { id: 'week-2', name: 'Week 2', status: 'active' },
  round: { id: 'w2-r2', roundNumber: 2, status: 'in_progress' },
  deckCount: 2,
  decklists: [{ id: 'alice-official' }],
  players: [{ user: { id: 'user-alice' }, registeredCount: 1, requiredCount: 2 }],
};

const seasonId = '22222222-2222-4222-8222-222222222222';

describe('admin deck checks route', () => {
  beforeEach(() => {
    deckCheckMocks.getAdminDeckChecks.mockReset();
    deckCheckMocks.getAdminDeckChecks.mockResolvedValue(serviceReturn);
  });

  it('returns 403 when not admin', async () => {
    const response = await request(app).get('/api/admin/deck-checks').set('x-test-role', 'user');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(deckCheckMocks.getAdminDeckChecks).not.toHaveBeenCalled();
  });

  it('returns 400 when seasonId is not a uuid', async () => {
    const response = await request(app)
      .get('/api/admin/deck-checks?seasonId=not-a-uuid')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(deckCheckMocks.getAdminDeckChecks).not.toHaveBeenCalled();
  });

  it('returns 404 when the season is missing', async () => {
    deckCheckMocks.getAdminDeckChecks.mockRejectedValue(new AppError(404, 'NOT_FOUND', 'Season not found'));

    const response = await request(app)
      .get(`/api/admin/deck-checks?seasonId=${seasonId}`)
      .set('x-test-role', 'admin');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 and calls the service with undefined when query is omitted', async () => {
    const response = await request(app).get('/api/admin/deck-checks').set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: serviceReturn });
    expect(deckCheckMocks.getAdminDeckChecks).toHaveBeenCalledWith(undefined);
  });

  it('returns 200 and calls the service with undefined when seasonId is empty', async () => {
    const response = await request(app).get('/api/admin/deck-checks?seasonId=').set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: serviceReturn });
    expect(deckCheckMocks.getAdminDeckChecks).toHaveBeenCalledWith(undefined);
  });

  it('returns 200 with the service payload when seasonId is a uuid', async () => {
    const response = await request(app)
      .get(`/api/admin/deck-checks?seasonId=${seasonId}`)
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(serviceReturn);
    expect(deckCheckMocks.getAdminDeckChecks).toHaveBeenCalledWith(seasonId);
  });
});
