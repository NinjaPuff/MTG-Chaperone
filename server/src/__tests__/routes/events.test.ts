import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  startEvent: vi.fn(),
  recomputeStandings: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', displayName: 'Admin', slug: 'admin', avatarUrl: null, role: 'admin' };
    next();
  },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/eventService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/eventService.js')>();
  return {
    ...actual,
    startEvent: mocks.startEvent,
  };
});

vi.mock('../../services/standingsService.js', () => ({
  recomputeStandings: mocks.recomputeStandings,
}));

import app from '../../index.js';

describe('events routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.startEvent.mockReset();
    mocks.recomputeStandings.mockReset();
  });

  it('starts an event', async () => {
    mocks.startEvent.mockResolvedValue({ id: 'event-1', status: 'active' });

    const response = await request(app).post('/api/events/event-1/start');

    expect(response.status).toBe(200);
    expect(mocks.startEvent).toHaveBeenCalledWith('event-1');
    expect(response.body.data.status).toBe('active');
  });

  it('validates seed uniqueness', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'setup',
      season: {
        league: {
          memberships: [
            { userId: '11111111-1111-4111-8111-111111111111' },
            { userId: '22222222-2222-4222-8222-222222222222' },
          ],
        },
      },
    });

    const response = await request(app)
      .put('/api/events/event-1/seeds')
      .send({
        seeds: [
          { userId: '11111111-1111-4111-8111-111111111111', seedNum: 1 },
          { userId: '11111111-1111-4111-8111-111111111111', seedNum: 2 },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Seed users and seed numbers must be unique');
    expect(prismaMock.eventSeed.createMany).not.toHaveBeenCalled();
  });
});
