import { prisma } from '../lib/prisma.js';
import { configurePassport as configurePassportDefault } from '../config/passport.js';
import { createErrorHandler } from '../middleware/errorHandler.js';
import * as authMiddleware from '../middleware/auth.js';
import type { AppConfig, AppDeps } from './types.js';

export function createDeps(config: AppConfig): AppDeps {
  const logger = {
    info: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  };

  const clock = {
    now: () => new Date(),
  };

  const rng = {
    next: () => Math.random(),
  };

  const http = {
    fetch: globalThis.fetch.bind(globalThis),
  };

  const errorHandler = createErrorHandler(logger);
  const configurePassport = () => {
    configurePassportDefault();
  };

  return {
    config,
    prisma,
    logger,
    clock,
    rng,
    http,
    services: {
      configurePassport,
      errorHandler,
      auth: {
        requireAuth: authMiddleware.requireAuth,
        requireAdmin: authMiddleware.requireAdmin,
        optionalAuth: authMiddleware.requireAuth,
      },
    },
  };
}
