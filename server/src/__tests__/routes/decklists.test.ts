import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

const mocks = vi.hoisted(() => ({
  createDecklist: vi.fn(),
  getDecklistById: vi.fn(),
  listDecklistsForSeason: vi.fn(),
  submitDecklist: vi.fn(),
  updateDecklist: vi.fn(),
  validateDecklist: vi.fn(),
}));

vi.mock('../../config/passport.js', () => ({
  configurePassport: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-test-user'] ?? 'user-1',
      displayName: 'Test User',
      slug: 'test-user',
      avatarUrl: null,
      role: req.headers['x-test-role'] === 'admin' ? 'admin' : 'user',
    };
    next();
  },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  getAuthUser: (req: any) => req.user,
}));

vi.mock('../../services/decklistService.js', () => ({
  createDecklist: mocks.createDecklist,
  getDecklistById: mocks.getDecklistById,
  listDecklistsForSeason: mocks.listDecklistsForSeason,
  submitDecklist: mocks.submitDecklist,
  updateDecklist: mocks.updateDecklist,
  validateDecklist: mocks.validateDecklist,
}));

import app from '../../index.js';

describe('decklists routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    mocks.createDecklist.mockReset();
    mocks.getDecklistById.mockReset();
    mocks.listDecklistsForSeason.mockReset();
    mocks.submitDecklist.mockReset();
    mocks.updateDecklist.mockReset();
    mocks.validateDecklist.mockReset();
  });

  it('gets a decklist by id', async () => {
    mocks.getDecklistById.mockResolvedValue({ id: 'deck-1' });

    const response = await request(app).get('/api/decklists/deck-1').set('x-test-user', 'user-1');

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('deck-1');
    expect(mocks.getDecklistById).toHaveBeenCalledWith('deck-1', 'user-1', false);
  });

  it('lists user decklists for a season', async () => {
    mocks.listDecklistsForSeason.mockResolvedValue([{ id: 'deck-1' }]);

    const response = await request(app)
      .get('/api/decklists/my-season/11111111-1111-4111-8111-111111111111')
      .set('x-test-user', 'user-1');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(mocks.listDecklistsForSeason).toHaveBeenCalledWith('user-1', '11111111-1111-4111-8111-111111111111');
  });

  it('creates a decklist', async () => {
    mocks.createDecklist.mockResolvedValue({ id: 'deck-1' });

    const response = await request(app).post('/api/decklists').set('x-test-user', 'user-1').send({
      eventId: '11111111-1111-4111-8111-111111111111',
      roundId: '22222222-2222-4222-8222-222222222222',
      orderIndex: 1,
      prepopulateFromPrevious: true,
      name: 'Deck Alpha',
    });

    expect(response.status).toBe(201);
    expect(mocks.createDecklist).toHaveBeenCalledWith({
      eventId: '11111111-1111-4111-8111-111111111111',
      name: 'Deck Alpha',
      orderIndex: 1,
      prepopulateFromPrevious: true,
      roundId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
    });
  });

  it('updates decklist name and entries', async () => {
    mocks.updateDecklist.mockResolvedValue({ id: 'deck-1' });

    const response = await request(app).patch('/api/decklists/deck-1').set('x-test-user', 'user-1').send({
      name: 'Updated',
      entries: [
        {
          cachedCardId: 'card-a',
          quantity: 2,
          zone: 'main',
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(mocks.updateDecklist).toHaveBeenCalledWith('deck-1', 'user-1', false, {
      entries: [{ cachedCardId: 'card-a', quantity: 2, zone: 'main' }],
      name: 'Updated',
    });
  });

  it('returns validation payload', async () => {
    mocks.validateDecklist.mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    const response = await request(app).get('/api/decklists/deck-1/validate').set('x-test-user', 'user-1');

    expect(response.status).toBe(200);
    expect(response.body.data.isValid).toBe(true);
    expect(mocks.validateDecklist).toHaveBeenCalledWith('deck-1', 'user-1', false);
  });

  it('submits a decklist', async () => {
    mocks.submitDecklist.mockResolvedValue({ id: 'deck-1', status: 'submitted' });

    const response = await request(app).post('/api/decklists/deck-1/submit').set('x-test-user', 'user-1');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('submitted');
    expect(mocks.submitDecklist).toHaveBeenCalledWith('deck-1', 'user-1', false);
  });
});
