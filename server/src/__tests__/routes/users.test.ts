import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

process.env.NODE_ENV = 'test';

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
      req.user = {
        id: 'user-1',
        displayName: 'User',
        publicName: null,
        slug: 'user',
        avatarUrl: null,
        role: 'user',
      };
      next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../services/userProfileService.js', () => ({
  getPublicProfile: vi.fn(),
  getUserMatchHistory: vi.fn(),
}));

import app from '../../index.js';
import { getPublicProfile, getUserMatchHistory } from '../../services/userProfileService.js';

const profileMocks = vi.mocked({ getPublicProfile, getUserMatchHistory });

const baseProfile = {
  id: 'user-1',
  displayName: 'User',
  publicName: null,
  discordHandle: null,
  slug: 'user',
  avatarUrl: null,
  role: 'user' as const,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const googleProfileRow = {
  ...baseProfile,
  discordId: null,
  googleId: 'google-1',
};

describe('users routes', () => {
  beforeEach(() => {
    resetPrismaMock();
    profileMocks.getPublicProfile.mockReset();
    profileMocks.getUserMatchHistory.mockReset();
  });

  describe('GET /api/users/profile', () => {
    it('returns profile including discordHandle and authProvider', async () => {
      prismaMock.user.findUnique.mockResolvedValue(googleProfileRow);

      const response = await request(app).get('/api/users/profile');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          discordHandle: null,
          authProvider: 'google',
        }),
      );
      expect(response.body.data).not.toHaveProperty('googleId');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ discordHandle: true, discordId: true, googleId: true }),
        }),
      );
    });
  });

  describe('PATCH /api/users/profile', () => {
    it('sets discordHandle for google users', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: null });
      prismaMock.user.update.mockResolvedValue({
        ...googleProfileRow,
        discordHandle: 'mydiscord',
      });

      const response = await request(app)
        .patch('/api/users/profile')
        .send({ publicName: null, discordHandle: 'mydiscord' });

      expect(response.status).toBe(200);
      expect(response.body.data.discordHandle).toBe('mydiscord');
      expect(response.body.data.authProvider).toBe('google');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { publicName: null, discordHandle: 'mydiscord' },
        }),
      );
    });

    it('rejects discordHandle updates for discord sign-in users', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: 'discord-1' });

      const response = await request(app)
        .patch('/api/users/profile')
        .send({ publicName: null, discordHandle: 'custom' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('clears discordHandle with empty string', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: null });
      prismaMock.user.update.mockResolvedValue(googleProfileRow);

      const response = await request(app)
        .patch('/api/users/profile')
        .send({ publicName: null, discordHandle: '' });

      expect(response.status).toBe(200);
      expect(response.body.data.discordHandle).toBeNull();
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { publicName: null, discordHandle: null },
        }),
      );
    });

    it('clears discordHandle with null', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: null });
      prismaMock.user.update.mockResolvedValue(googleProfileRow);

      const response = await request(app)
        .patch('/api/users/profile')
        .send({ publicName: null, discordHandle: null });

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { publicName: null, discordHandle: null },
        }),
      );
    });

    it('rejects invalid discordHandle without updating', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: null });

      const response = await request(app)
        .patch('/api/users/profile')
        .send({ publicName: null, discordHandle: 'bad name!' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('updates publicName only when discordHandle is omitted', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: null });
      prismaMock.user.update.mockResolvedValue({
        ...googleProfileRow,
        publicName: 'Alias',
      });

      const response = await request(app)
        .patch('/api/users/profile')
        .send({ publicName: 'Alias' });

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { publicName: 'Alias' },
        }),
      );
      expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty('discordHandle');
    });

    it('updates both publicName and discordHandle', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: null });
      prismaMock.user.update.mockResolvedValue({
        ...googleProfileRow,
        publicName: 'Alias',
        discordHandle: 'handle',
      });

      const response = await request(app)
        .patch('/api/users/profile')
        .send({ publicName: 'Alias', discordHandle: 'handle' });

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { publicName: 'Alias', discordHandle: 'handle' },
        }),
      );
    });

    it('never modifies displayName', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ discordId: null });
      prismaMock.user.update.mockResolvedValue({
        ...googleProfileRow,
        discordHandle: 'mydiscord',
      });

      await request(app)
        .patch('/api/users/profile')
        .send({ publicName: null, discordHandle: 'mydiscord' });

      expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty('displayName');
    });
  });

  describe('GET /api/users/:slug', () => {
    it('returns public profile payload', async () => {
      profileMocks.getPublicProfile.mockResolvedValue({
        user: { slug: 'alice', displayName: 'Alice' },
        league: { slug: 'test-league', name: 'Test League' },
        activeSeason: null,
        currentStanding: null,
        career: {
          seasonsPlayed: 0,
          totalMatches: 0,
          matchWins: 0,
          matchLosses: 0,
          matchDraws: 0,
          winRate: 0,
        },
        seasonHistory: [],
        links: { poolId: null, poolVisible: false, decklistsVisible: false },
      } as any);

      const response = await request(app).get('/api/users/alice');

      expect(response.status).toBe(200);
      expect(response.body.data.user.slug).toBe('alice');
      expect(profileMocks.getPublicProfile).toHaveBeenCalledWith('alice', null);
    });
  });

  describe('GET /api/users/:slug/match-history', () => {
    it('returns paginated match history', async () => {
      profileMocks.getUserMatchHistory.mockResolvedValue({
        data: [{ matchId: 'match-1', result: 'win' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      } as any);

      const response = await request(app).get('/api/users/alice/match-history?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(profileMocks.getUserMatchHistory).toHaveBeenCalledWith('alice', {
        seasonId: undefined,
        page: 1,
        limit: 20,
      });
    });
  });
});
