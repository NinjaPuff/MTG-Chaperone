import { vi } from 'vitest';

export const prismaMock = {
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return arg(prismaMock);
    }
    return arg;
  }),
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  league: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  leagueMembership: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  season: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  standing: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  event: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  eventConfig: {
    update: vi.fn(),
  },
  eventSeed: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  playerDrop: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  bracketSlot: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  round: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  roundRobinSchedule: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  scheduledPairing: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  match: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  gameResult: {
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  decklist: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  decklistEntry: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  deckUniquenessRule: {
    findUnique: vi.fn(),
  },
  cachedCard: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  inviteLink: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  cardPool: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  poolAcquisition: {
    findUnique: vi.fn(),
  },
  boosterProduct: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  boosterSetCode: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
};

export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    if (model && typeof model === 'object') {
      for (const method of Object.values(model)) {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as ReturnType<typeof vi.fn>).mockReset();
        }
      }
    }
  }
}
