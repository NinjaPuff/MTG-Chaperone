import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const scryfallMocks = vi.hoisted(() => ({
  getSetCacheStats: vi.fn(),
  importSetFromScryfall: vi.fn(),
  bulkImportSet: vi.fn(),
}));

const boosterMocks = vi.hoisted(() => ({
  getBoosterProduct: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
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
  requireAdmin: (req: any, _res: any, next: any) => {
    if (req.user?.role !== 'admin') {
      next(new AppError(403, 'FORBIDDEN', 'Admin access required'));
      return;
    }
    next();
  },
}));

vi.mock('../../services/scryfallService.js', () => ({
  getSetCacheStats: scryfallMocks.getSetCacheStats,
  importSetFromScryfall: scryfallMocks.importSetFromScryfall,
  bulkImportSet: scryfallMocks.bulkImportSet,
  searchCards: vi.fn(),
  bulkLookupByName: vi.fn(),
  getCard: vi.fn(),
  getCardFaces: vi.fn(),
  lookupCanonicalByName: vi.fn(),
}));

vi.mock('../../services/boosterProductService.js', () => ({
  getBoosterProduct: boosterMocks.getBoosterProduct,
  createBoosterProduct: vi.fn(),
  deleteBoosterProduct: vi.fn(),
  listBoosterProducts: vi.fn(),
  updateBoosterProduct: vi.fn(),
}));

import app from '../../index.js';

describe('admin card cache routes', () => {
  beforeEach(() => {
    scryfallMocks.getSetCacheStats.mockReset();
    scryfallMocks.importSetFromScryfall.mockReset();
    scryfallMocks.bulkImportSet.mockReset();
    boosterMocks.getBoosterProduct.mockReset();
  });

  it('returns cache stats for admins', async () => {
    scryfallMocks.getSetCacheStats.mockResolvedValue([
      { setCode: 'DMU', cachedCount: 412, lastFetched: '2026-05-31T12:00:00.000Z' },
      { setCode: 'MUL', cachedCount: 0, lastFetched: null },
    ]);

    const response = await request(app)
      .get('/api/admin/card-cache/stats?setCodes=DMU,MUL')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(scryfallMocks.getSetCacheStats).toHaveBeenCalledWith(['DMU', 'MUL']);
    expect(response.body.data).toEqual([
      { setCode: 'DMU', cachedCount: 412, lastFetched: '2026-05-31T12:00:00.000Z' },
      { setCode: 'MUL', cachedCount: 0, lastFetched: null },
    ]);
  });

  it('rejects cache stats for non-admins', async () => {
    const response = await request(app)
      .get('/api/admin/card-cache/stats?setCodes=DMU')
      .set('x-test-role', 'user');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(scryfallMocks.getSetCacheStats).not.toHaveBeenCalled();
  });

  it('validates setCodes query param for stats', async () => {
    const response = await request(app)
      .get('/api/admin/card-cache/stats')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(scryfallMocks.getSetCacheStats).not.toHaveBeenCalled();
  });

  it('imports a single set for admins', async () => {
    scryfallMocks.importSetFromScryfall.mockResolvedValue({ setCode: 'DMU', imported: 5 });
    scryfallMocks.getSetCacheStats.mockResolvedValue([
      { setCode: 'DMU', cachedCount: 412, lastFetched: '2026-05-31T12:00:00.000Z' },
    ]);

    const response = await request(app)
      .post('/api/admin/card-cache/import-set')
      .set('x-test-role', 'admin')
      .send({ setCode: 'DMU' });

    expect(response.status).toBe(200);
    expect(scryfallMocks.importSetFromScryfall).toHaveBeenCalledWith('DMU');
    expect(response.body.data.results).toEqual([
      {
        setCode: 'DMU',
        imported: 5,
        cachedCount: 412,
        lastFetched: '2026-05-31T12:00:00.000Z',
      },
    ]);
    expect(response.body.data.totalImported).toBe(5);
  });

  it('rejects single-set import for non-admins', async () => {
    const response = await request(app)
      .post('/api/admin/card-cache/import-set')
      .set('x-test-role', 'user')
      .send({ setCode: 'DMU' });

    expect(response.status).toBe(403);
    expect(scryfallMocks.importSetFromScryfall).not.toHaveBeenCalled();
  });

  it('validates import-set body', async () => {
    const response = await request(app)
      .post('/api/admin/card-cache/import-set')
      .set('x-test-role', 'admin')
      .send({ setCode: '' });

    expect(response.status).toBe(400);
    expect(scryfallMocks.importSetFromScryfall).not.toHaveBeenCalled();
  });

  it('imports multiple sets via bulk file for admins', async () => {
    scryfallMocks.bulkImportSet.mockResolvedValue({
      results: [
        { setCode: 'DMU', imported: 2 },
        { setCode: 'STX', imported: 1 },
      ],
      totalImported: 3,
    });
    scryfallMocks.getSetCacheStats.mockResolvedValue([
      { setCode: 'DMU', cachedCount: 2, lastFetched: '2026-05-31T12:00:00.000Z' },
      { setCode: 'STX', cachedCount: 1, lastFetched: '2026-05-31T12:00:00.000Z' },
    ]);

    const response = await request(app)
      .post('/api/admin/card-cache/import-sets')
      .set('x-test-role', 'admin')
      .send({ setCodes: ['DMU', 'STX'] });

    expect(response.status).toBe(200);
    expect(scryfallMocks.bulkImportSet).toHaveBeenCalledWith(['DMU', 'STX']);
    expect(response.body.data.totalImported).toBe(3);
  });

  it('rejects import-sets for non-admins', async () => {
    const response = await request(app)
      .post('/api/admin/card-cache/import-sets')
      .set('x-test-role', 'user')
      .send({ setCodes: ['DMU'] });

    expect(response.status).toBe(403);
    expect(scryfallMocks.bulkImportSet).not.toHaveBeenCalled();
  });

  it('validates import-sets body', async () => {
    const response = await request(app)
      .post('/api/admin/card-cache/import-sets')
      .set('x-test-role', 'admin')
      .send({ setCodes: [] });

    expect(response.status).toBe(400);
    expect(scryfallMocks.bulkImportSet).not.toHaveBeenCalled();
  });

  it('imports all sets for a booster product', async () => {
    boosterMocks.getBoosterProduct.mockResolvedValue({
      id: 'prod-1',
      setCodes: [{ setCode: 'DMU' }, { setCode: 'MUL' }],
    });
    scryfallMocks.importSetFromScryfall
      .mockResolvedValueOnce({ setCode: 'DMU', imported: 400 })
      .mockResolvedValueOnce({ setCode: 'MUL', imported: 10 });
    scryfallMocks.getSetCacheStats.mockResolvedValue([
      { setCode: 'DMU', cachedCount: 400, lastFetched: '2026-05-31T12:00:00.000Z' },
      { setCode: 'MUL', cachedCount: 10, lastFetched: '2026-05-31T12:00:00.000Z' },
    ]);

    const response = await request(app)
      .post('/api/admin/card-cache/import-booster-product/prod-1')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(boosterMocks.getBoosterProduct).toHaveBeenCalledWith('prod-1');
    expect(scryfallMocks.importSetFromScryfall).toHaveBeenCalledWith('DMU');
    expect(scryfallMocks.importSetFromScryfall).toHaveBeenCalledWith('MUL');
    expect(scryfallMocks.bulkImportSet).not.toHaveBeenCalled();
    expect(response.body.data.totalImported).toBe(410);
  });

  it('continues booster product import when one set fails', async () => {
    boosterMocks.getBoosterProduct.mockResolvedValue({
      id: 'prod-1',
      setCodes: [{ setCode: 'TMT' }, { setCode: 'PZA' }],
    });
    scryfallMocks.importSetFromScryfall
      .mockRejectedValueOnce(new AppError(502, 'SCRYFALL_ERROR', 'Scryfall request failed: 502'))
      .mockResolvedValueOnce({ setCode: 'PZA', imported: 20 });
    scryfallMocks.getSetCacheStats.mockResolvedValue([
      { setCode: 'TMT', cachedCount: 2, lastFetched: '2026-05-31T12:00:00.000Z' },
      { setCode: 'PZA', cachedCount: 20, lastFetched: '2026-05-31T12:00:00.000Z' },
    ]);

    const response = await request(app)
      .post('/api/admin/card-cache/import-booster-product/prod-1')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(scryfallMocks.importSetFromScryfall).toHaveBeenCalledWith('TMT');
    expect(scryfallMocks.importSetFromScryfall).toHaveBeenCalledWith('PZA');
    expect(response.body.data.totalImported).toBe(20);
    expect(response.body.data.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ setCode: 'TMT', imported: 0, error: 'Scryfall request failed: 502' }),
        expect.objectContaining({ setCode: 'PZA', imported: 20, cachedCount: 20 }),
      ]),
    );
  });

  it('rejects booster product import for non-admins', async () => {
    const response = await request(app)
      .post('/api/admin/card-cache/import-booster-product/prod-1')
      .set('x-test-role', 'user');

    expect(response.status).toBe(403);
    expect(boosterMocks.getBoosterProduct).not.toHaveBeenCalled();
    expect(scryfallMocks.importSetFromScryfall).not.toHaveBeenCalled();
    expect(scryfallMocks.bulkImportSet).not.toHaveBeenCalled();
  });

  it('returns not found for unknown booster product', async () => {
    boosterMocks.getBoosterProduct.mockRejectedValue(new AppError(404, 'NOT_FOUND', 'Booster product not found'));

    const response = await request(app)
      .post('/api/admin/card-cache/import-booster-product/missing')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(scryfallMocks.bulkImportSet).not.toHaveBeenCalled();
  });

  it('forwards scryfall errors from import-set', async () => {
    scryfallMocks.importSetFromScryfall.mockRejectedValue(
      new AppError(502, 'SCRYFALL_ERROR', 'Scryfall request failed: 502'),
    );

    const response = await request(app)
      .post('/api/admin/card-cache/import-set')
      .set('x-test-role', 'admin')
      .send({ setCode: 'DMU' });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('SCRYFALL_ERROR');
  });
});
