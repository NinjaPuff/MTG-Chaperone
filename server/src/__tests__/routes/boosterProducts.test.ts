import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  createBoosterProduct: vi.fn(),
  getBoosterProduct: vi.fn(),
  listBoosterProducts: vi.fn(),
  updateBoosterProduct: vi.fn(),
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

vi.mock('../../services/boosterProductService.js', () => ({
  createBoosterProduct: mocks.createBoosterProduct,
  deleteBoosterProduct: vi.fn(),
  getBoosterProduct: mocks.getBoosterProduct,
  listBoosterProducts: mocks.listBoosterProducts,
  updateBoosterProduct: mocks.updateBoosterProduct,
}));

import app from '../../index.js';
import { AppError } from '../../middleware/errorHandler.js';

describe('booster products routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.createBoosterProduct.mockReset();
    mocks.getBoosterProduct.mockReset();
    mocks.listBoosterProducts.mockReset();
    mocks.updateBoosterProduct.mockReset();
  });

  it('creates a booster product with primarySetCode', async () => {
    mocks.createBoosterProduct.mockResolvedValue({
      id: 'product-1',
      primarySetCode: 'STX',
      setCodes: [{ setCode: 'SNC' }, { setCode: 'STX' }],
    });

    const response = await request(app)
      .post('/api/booster-products')
      .set('x-test-user', 'admin-1')
      .send({
        name: 'Secrets of Strixhaven',
        setReleaseName: 'Strixhaven',
        boosterType: 'play',
        setCodes: ['SNC', 'STX'],
        primarySetCode: 'STX',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.primarySetCode).toBe('STX');
    expect(mocks.createBoosterProduct).toHaveBeenCalledWith(
      expect.objectContaining({ primarySetCode: 'STX' }),
    );
  });

  it('rejects create when primary is not in set codes', async () => {
    mocks.createBoosterProduct.mockRejectedValue(
      new AppError(400, 'VALIDATION_ERROR', 'Primary set code must be one of the product set codes'),
    );

    const response = await request(app)
      .post('/api/booster-products')
      .set('x-test-user', 'admin-1')
      .send({
        name: 'Test',
        setReleaseName: 'Test',
        boosterType: 'draft',
        setCodes: ['DMU'],
        primarySetCode: 'MKM',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('patches primarySetCode only', async () => {
    mocks.updateBoosterProduct.mockResolvedValue({
      id: 'product-1',
      primarySetCode: 'STX',
    });

    const response = await request(app)
      .patch('/api/booster-products/product-1')
      .set('x-test-user', 'admin-1')
      .send({ primarySetCode: 'STX' });

    expect(response.status).toBe(200);
    expect(response.body.data.primarySetCode).toBe('STX');
    expect(mocks.updateBoosterProduct).toHaveBeenCalledWith('product-1', { primarySetCode: 'STX' });
  });

  it('allows idempotent patch with the same primary', async () => {
    mocks.updateBoosterProduct.mockResolvedValue({
      id: 'product-1',
      primarySetCode: 'STX',
    });

    const response = await request(app)
      .patch('/api/booster-products/product-1')
      .set('x-test-user', 'admin-1')
      .send({ primarySetCode: 'STX' });

    expect(response.status).toBe(200);
    expect(response.body.data.primarySetCode).toBe('STX');
  });

  it('rejects patch when primary is not in set codes', async () => {
    mocks.updateBoosterProduct.mockRejectedValue(
      new AppError(400, 'VALIDATION_ERROR', 'Primary set code must be one of the product set codes'),
    );

    const response = await request(app)
      .patch('/api/booster-products/product-1')
      .set('x-test-user', 'admin-1')
      .send({ primarySetCode: 'MKM' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists booster products with primarySetCode', async () => {
    mocks.listBoosterProducts.mockResolvedValue([
      { id: 'product-1', primarySetCode: 'STX', setCodes: [{ setCode: 'STX' }] },
    ]);

    const response = await request(app).get('/api/booster-products');

    expect(response.status).toBe(200);
    expect(response.body.data[0].primarySetCode).toBe('STX');
  });
});
