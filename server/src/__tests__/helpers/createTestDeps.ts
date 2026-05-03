import { loadConfig } from '../../di/config.js';
import { createDeps } from '../../di/deps.js';
import type { AppDeps } from '../../di/types.js';
import { prismaMock } from './prismaMock.js';

export function createTestDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const config = loadConfig({
    NODE_ENV: 'test',
    SERVER_PORT: '3000',
    CLIENT_URL: 'http://localhost:5173',
    JWT_SECRET: 'test-secret',
  });

  const deps = createDeps(config);
  const base: AppDeps = {
    ...deps,
    prisma: prismaMock as unknown as AppDeps['prisma'],
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };

  const overrideServices: Partial<AppDeps['services']> = overrides.services ?? {};
  const overrideAuth: Partial<AppDeps['services']['auth']> = overrideServices.auth ?? {};

  return {
    ...base,
    ...overrides,
    config: { ...base.config, ...(overrides.config ?? {}) },
    logger: { ...base.logger, ...(overrides.logger ?? {}) } as AppDeps['logger'],
    clock: { ...base.clock, ...(overrides.clock ?? {}) } as AppDeps['clock'],
    rng: { ...base.rng, ...(overrides.rng ?? {}) } as AppDeps['rng'],
    http: { ...base.http, ...(overrides.http ?? {}) } as AppDeps['http'],
    services: {
      ...base.services,
      ...overrideServices,
      auth: {
        ...base.services.auth,
        ...overrideAuth,
      },
    },
  };
}
