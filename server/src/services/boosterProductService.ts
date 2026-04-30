import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type BoosterPayload = {
  name: string;
  setReleaseName: string;
  boosterType: 'draft' | 'play' | 'set' | 'collector';
  setCodes: string[];
};

const normalizeSetCodes = (setCodes: string[]) =>
  Array.from(new Set(setCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)));

export async function listBoosterProducts() {
  return prisma.boosterProduct.findMany({
    include: {
      setCodes: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBoosterProduct(payload: BoosterPayload) {
  const setCodes = normalizeSetCodes(payload.setCodes);
  if (setCodes.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one set code is required');
  }

  return prisma.boosterProduct.create({
    data: {
      name: payload.name,
      setReleaseName: payload.setReleaseName,
      boosterType: payload.boosterType,
      setCodes: {
        createMany: {
          data: setCodes.map((setCode) => ({ setCode })),
        },
      },
    },
    include: {
      setCodes: true,
    },
  });
}

export async function getBoosterProduct(id: string) {
  const product = await prisma.boosterProduct.findUnique({
    where: { id },
    include: {
      setCodes: true,
    },
  });

  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Booster product not found');
  }

  return product;
}

export async function updateBoosterProduct(id: string, payload: Partial<BoosterPayload>) {
  const existing = await getBoosterProduct(id);
  const setCodes = payload.setCodes ? normalizeSetCodes(payload.setCodes) : existing.setCodes.map((code) => code.setCode);

  const updated = await prisma.boosterProduct.update({
    where: { id },
    data: {
      name: payload.name ?? existing.name,
      setReleaseName: payload.setReleaseName ?? existing.setReleaseName,
      boosterType: payload.boosterType ?? existing.boosterType,
      setCodes: {
        deleteMany: {},
        createMany: {
          data: setCodes.map((setCode) => ({ setCode })),
        },
      },
    },
    include: {
      setCodes: true,
    },
  });

  return updated;
}

export async function deleteBoosterProduct(id: string) {
  await getBoosterProduct(id);
  await prisma.boosterProduct.delete({ where: { id } });
}
