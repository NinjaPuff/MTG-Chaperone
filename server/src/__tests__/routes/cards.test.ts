import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  getCard: vi.fn(),
  getCardFaces: vi.fn(),
  searchCards: vi.fn(),
  bulkLookupByName: vi.fn(),
  lookupCanonicalByName: vi.fn(),
  bulkImportSet: vi.fn(),
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

vi.mock('../../services/scryfallService.js', () => ({
  getCard: mocks.getCard,
  getCardFaces: mocks.getCardFaces,
  searchCards: mocks.searchCards,
  bulkLookupByName: mocks.bulkLookupByName,
  lookupCanonicalByName: mocks.lookupCanonicalByName,
  bulkImportSet: mocks.bulkImportSet,
}));

import app from '../../index.js';

describe('cards routes', () => {
  beforeEach(() => {
    mocks.getCard.mockReset();
    mocks.getCardFaces.mockReset();
    mocks.searchCards.mockReset();
    mocks.bulkLookupByName.mockReset();
    mocks.lookupCanonicalByName.mockReset();
    mocks.bulkImportSet.mockReset();
  });

  it('returns card faces for a valid card id', async () => {
    mocks.getCardFaces.mockResolvedValue([
      { name: 'Front Face', imageUris: { normal: 'front-url' } },
      { name: 'Back Face', imageUris: { normal: 'back-url' } },
    ]);

    const response = await request(app).get('/api/cards/abc123/faces');

    expect(response.status).toBe(200);
    expect(mocks.getCardFaces).toHaveBeenCalledWith('abc123');
    expect(response.body.data.faces).toHaveLength(2);
    expect(response.body.data.faces[1].name).toBe('Back Face');
  });

  it('forwards scryfall errors from faces endpoint', async () => {
    mocks.getCardFaces.mockRejectedValue(new AppError(404, 'NOT_FOUND', 'Card not found'));

    const response = await request(app).get('/api/cards/missing/faces');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Card not found');
  });

  it('rejects bulk import for non-admin users', async () => {
    const response = await request(app)
      .post('/api/cards/bulk-import')
      .set('x-test-role', 'user')
      .send({ setCodes: ['DMU'] });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mocks.bulkImportSet).not.toHaveBeenCalled();
  });

  it('allows admins to bulk import sets', async () => {
    mocks.bulkImportSet.mockResolvedValue({
      results: [{ setCode: 'DMU', imported: 412 }],
      totalImported: 412,
    });

    const response = await request(app)
      .post('/api/cards/bulk-import')
      .set('x-test-role', 'admin')
      .send({ setCodes: ['DMU'] });

    expect(response.status).toBe(200);
    expect(mocks.bulkImportSet).toHaveBeenCalledWith(['DMU']);
    expect(response.body.data.totalImported).toBe(412);
  });
});
