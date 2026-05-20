import { resolvePrimarySetCode } from '@mtg-league/shared';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type BoosterPayload = {
  name: string;
  setReleaseName: string;
  boosterType: 'draft' | 'play' | 'set' | 'collector';
  setCodes: string[];
  primarySetCode?: string | null;
};

const setCodesInclude = {
  setCodes: {
    orderBy: { setCode: 'asc' as const },
  },
};

const normalizeSetCodes = (setCodes: string[]) =>
  Array.from(new Set(setCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

function assertPrimaryInSetCodes(setCodes: string[], primarySetCode: string | null | undefined) {
  if (primarySetCode == null || primarySetCode === '') {
    return;
  }

  const normalized = primarySetCode.trim().toUpperCase();
  if (!setCodes.includes(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Primary set code must be one of the product set codes');
  }
}

export async function listBoosterProducts() {
  return prisma.boosterProduct.findMany({
    include: setCodesInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBoosterProduct(payload: BoosterPayload) {
  const setCodes = normalizeSetCodes(payload.setCodes);
  if (setCodes.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one set code is required');
  }

  assertPrimaryInSetCodes(setCodes, payload.primarySetCode);
  const primarySetCode = resolvePrimarySetCode(setCodes, payload.primarySetCode);

  return prisma.boosterProduct.create({
    data: {
      name: payload.name,
      setReleaseName: payload.setReleaseName,
      boosterType: payload.boosterType,
      primarySetCode,
      setCodes: {
        createMany: {
          data: setCodes.map((setCode) => ({ setCode })),
        },
      },
    },
    include: setCodesInclude,
  });
}

export async function getBoosterProduct(id: string) {
  const product = await prisma.boosterProduct.findUnique({
    where: { id },
    include: setCodesInclude,
  });

  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Booster product not found');
  }

  return product;
}

export async function updateBoosterProduct(id: string, payload: Partial<BoosterPayload>) {
  const existing = await getBoosterProduct(id);
  const setCodes = payload.setCodes
    ? normalizeSetCodes(payload.setCodes)
    : existing.setCodes.map((code) => code.setCode);

  if (payload.setCodes && setCodes.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one set code is required');
  }

  const explicitPrimary =
    payload.primarySetCode !== undefined
      ? payload.primarySetCode?.trim().toUpperCase() || null
      : undefined;

  if (explicitPrimary !== undefined) {
    assertPrimaryInSetCodes(setCodes, explicitPrimary);
  }

  const primarySetCode = resolvePrimarySetCode(
    setCodes,
    explicitPrimary !== undefined ? explicitPrimary : existing.primarySetCode,
  );

  return prisma.boosterProduct.update({
    where: { id },
    data: {
      name: payload.name ?? existing.name,
      setReleaseName: payload.setReleaseName ?? existing.setReleaseName,
      boosterType: payload.boosterType ?? existing.boosterType,
      primarySetCode,
      ...(payload.setCodes
        ? {
            setCodes: {
              deleteMany: {},
              createMany: {
                data: setCodes.map((setCode) => ({ setCode })),
              },
            },
          }
        : {}),
    },
    include: setCodesInclude,
  });
}

export async function deleteBoosterProduct(id: string) {
  await getBoosterProduct(id);
  await prisma.boosterProduct.delete({ where: { id } });
}

export function createBoosterProductService() {
  return {
    listBoosterProducts,
    createBoosterProduct,
    getBoosterProduct,
    updateBoosterProduct,
    deleteBoosterProduct,
  };
}
