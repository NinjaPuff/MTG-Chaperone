import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  createEvent: vi.fn(),
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
      req.user = { id: 'admin-1', displayName: 'Admin', slug: 'admin', avatarUrl: null, role: 'admin' };
      next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
    getAuthUser: (req: any) => req.user,
  };
});

vi.mock('../../services/eventService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/eventService.js')>();
  return {
    ...actual,
    createEvent: mocks.createEvent,
  };
});

import app from '../../index.js';

describe('seasons event create route', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.createEvent.mockReset();
  });

  it('rejects invalid minDeckSize before createEvent', async () => {
    const response = await request(app)
      .post('/api/seasons/11111111-1111-4111-8111-111111111111/events')
      .send({ name: 'Week 1', config: { format: 'swiss', minDeckSize: 41 } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fields['config.minDeckSize']).toBeDefined();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
});
