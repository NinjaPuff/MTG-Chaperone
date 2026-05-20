import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { AppError } from '../../middleware/errorHandler.js';
import {
  createBoosterProduct,
  updateBoosterProduct,
} from '../../services/boosterProductService.js';

describe('boosterProductService', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('stores primarySetCode on create when provided', async () => {
    prismaMock.boosterProduct.create.mockResolvedValue({
      id: 'product-1',
      primarySetCode: 'STX',
      setCodes: [{ setCode: 'SNC' }, { setCode: 'STX' }],
    });

    await createBoosterProduct({
      name: 'Secrets of Strixhaven',
      setReleaseName: 'Strixhaven',
      boosterType: 'play',
      setCodes: ['SNC', 'STX'],
      primarySetCode: 'STX',
    });

    expect(prismaMock.boosterProduct.create).toHaveBeenCalledWith({
      data: {
        name: 'Secrets of Strixhaven',
        setReleaseName: 'Strixhaven',
        boosterType: 'play',
        primarySetCode: 'STX',
        setCodes: {
          createMany: {
            data: [{ setCode: 'SNC' }, { setCode: 'STX' }],
          },
        },
      },
      include: {
        setCodes: {
          orderBy: { setCode: 'asc' },
        },
      },
    });
  });

  it('defaults primarySetCode to first sorted code on create', async () => {
    prismaMock.boosterProduct.create.mockResolvedValue({ id: 'product-1' });

    await createBoosterProduct({
      name: 'Test Product',
      setReleaseName: 'Test',
      boosterType: 'draft',
      setCodes: ['STX', 'SNC'],
    });

    expect(prismaMock.boosterProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primarySetCode: 'SNC',
        }),
      }),
    );
  });

  it('rejects create when primary is not in set codes', async () => {
    await expect(
      createBoosterProduct({
        name: 'Test Product',
        setReleaseName: 'Test',
        boosterType: 'draft',
        setCodes: ['DMU'],
        primarySetCode: 'MKM',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    } satisfies Partial<AppError>);

    expect(prismaMock.boosterProduct.create).not.toHaveBeenCalled();
  });

  it('rejects update when primary is not in set codes', async () => {
    prismaMock.boosterProduct.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Test',
      setReleaseName: 'Test',
      boosterType: 'draft',
      primarySetCode: 'DMU',
      setCodes: [{ setCode: 'DMU' }],
    });

    await expect(
      updateBoosterProduct('product-1', { primarySetCode: 'MKM' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });

    expect(prismaMock.boosterProduct.update).not.toHaveBeenCalled();
  });

  it('reassigns primary when current primary is removed from set codes', async () => {
    prismaMock.boosterProduct.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Test',
      setReleaseName: 'Test',
      boosterType: 'draft',
      primarySetCode: 'STX',
      setCodes: [{ setCode: 'SNC' }, { setCode: 'STX' }],
    });
    prismaMock.boosterProduct.update.mockResolvedValue({ id: 'product-1' });

    await updateBoosterProduct('product-1', { setCodes: ['SNC'] });

    expect(prismaMock.boosterProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primarySetCode: 'SNC',
        }),
      }),
    );
  });

  it('updates primary only on PATCH payload', async () => {
    prismaMock.boosterProduct.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Test',
      setReleaseName: 'Test',
      boosterType: 'draft',
      primarySetCode: 'SNC',
      setCodes: [{ setCode: 'SNC' }, { setCode: 'STX' }],
    });
    prismaMock.boosterProduct.update.mockResolvedValue({ id: 'product-1' });

    await updateBoosterProduct('product-1', { primarySetCode: 'STX' });

    expect(prismaMock.boosterProduct.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        name: 'Test',
        setReleaseName: 'Test',
        boosterType: 'draft',
        primarySetCode: 'STX',
      },
      include: {
        setCodes: {
          orderBy: { setCode: 'asc' },
        },
      },
    });
  });
});
