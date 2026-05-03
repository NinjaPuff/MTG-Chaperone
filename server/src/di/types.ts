import type { PrismaClient } from '@prisma/client';
import type { RequestHandler, ErrorRequestHandler } from 'express';

export type AppConfig = {
  nodeEnv: string;
  serverPort: number;
  clientUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  discordClientId?: string;
  discordClientSecret?: string;
  discordCallbackUrl: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleCallbackUrl: string;
};

export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export type Clock = {
  now: () => Date;
};

export type Rng = {
  next: () => number;
};

export type HttpClient = {
  fetch: typeof fetch;
};

export type JwtService = {
  signToken: (payload: { userId: string; displayName: string }) => string;
  verifyToken: (token: string) => { userId: string; displayName: string } | null;
};

export type AuthMiddlewareSet = {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  optionalAuth: RequestHandler;
};

export type AppServices = {
  configurePassport: () => void;
  errorHandler: ErrorRequestHandler;
  auth: AuthMiddlewareSet;
};

export type AppDeps = {
  config: AppConfig;
  prisma: PrismaClient;
  logger: Logger;
  clock: Clock;
  rng: Rng;
  http: HttpClient;
  services: AppServices;
};
