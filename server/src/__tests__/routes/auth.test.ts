import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const passportMock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  _strategy: vi.fn(() => ({})),
}));

vi.mock('passport', () => ({
  default: passportMock,
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {},
}));

import { createAuthRouter } from '../../routes/auth.js';

const clientUrl = 'http://localhost:5173';
const oauthFailureRedirect = `${clientUrl}/login?error=oauth_failed`;

function createTestApp() {
  const app = express();
  app.use(
    '/api/auth',
    createAuthRouter({
      config: {
        nodeEnv: 'test',
        serverPort: 3000,
        clientUrl,
        jwtSecret: 'test-secret',
        jwtExpiresIn: '7d',
        discordClientId: 'discord-id',
        discordClientSecret: 'discord-secret',
        discordCallbackUrl: 'http://localhost:3000/api/auth/discord/callback',
        googleClientId: 'google-id',
        googleClientSecret: 'google-secret',
        googleCallbackUrl: 'http://localhost:3000/api/auth/google/callback',
      },
    }),
  );
  return app;
}

describe('auth routes', () => {
  beforeEach(() => {
    passportMock.authenticate.mockReset();
    passportMock._strategy.mockReturnValue({});
  });

  it('redirects to login when Discord OAuth token exchange fails', async () => {
    passportMock.authenticate.mockImplementation((_strategy, _options, callback) => {
      return (_req, _res, _next) => {
        callback?.(new Error('Invalid "code" in request'), false);
      };
    });

    const response = await request(createTestApp()).get('/api/auth/discord/callback?code=expired');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(oauthFailureRedirect);
  });

  it('redirects to login when Google OAuth token exchange fails', async () => {
    passportMock.authenticate.mockImplementation((_strategy, _options, callback) => {
      return (_req, _res, _next) => {
        callback?.(new Error('Invalid "code" in request'), false);
      };
    });

    const response = await request(createTestApp()).get('/api/auth/google/callback?code=expired');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(oauthFailureRedirect);
  });

  it('redirects to auth callback when OAuth succeeds', async () => {
    passportMock.authenticate.mockImplementation((_strategy, _options, callback) => {
      return (_req, _res, next) => {
        callback?.(null, { id: 'user-1', displayName: 'User' });
        next();
      };
    });

    const response = await request(createTestApp()).get('/api/auth/discord/callback?code=valid');

    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^http:\/\/localhost:5173\/auth\/callback\?token=/);
  });
});
