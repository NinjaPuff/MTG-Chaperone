import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { addMember } from './leagueService.js';
import type { PrismaClient } from '@prisma/client';

type InviteStateInput = {
  status: 'active' | 'revoked';
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
};

export function validateInviteState(invite: InviteStateInput, now = new Date()) {
  if (invite.status !== 'active') {
    throw new AppError(404, 'INVALID_INVITE', 'Invite token is invalid');
  }

  if (invite.expiresAt && invite.expiresAt < now) {
    throw new AppError(400, 'INVITE_EXPIRED', 'Invite token has expired');
  }

  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    throw new AppError(400, 'INVITE_EXHAUSTED', 'Invite token has reached max uses');
  }
}

type InviteServiceDeps = {
  prisma: PrismaClient;
  addMember: (slug: string, userId: string) => Promise<unknown>;
  now: () => Date;
  generateInviteToken: () => string;
};

export function createInviteService(partialDeps?: Partial<InviteServiceDeps>) {
  const deps: InviteServiceDeps = {
    prisma,
    addMember,
    now: () => new Date(),
    generateInviteToken: () => crypto.randomBytes(18).toString('base64url'),
    ...partialDeps,
  };

  async function createInvite(leagueSlug: string, createdById: string, options: {
    maxUses?: number | null;
    expiresAt?: string | null;
  }) {
    const league = await deps.prisma.league.findUnique({
      where: { slug: leagueSlug },
      select: { id: true },
    });

    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    return deps.prisma.inviteLink.create({
      data: {
        leagueId: league.id,
        token: deps.generateInviteToken(),
        createdById,
        maxUses: options.maxUses ?? null,
        expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
      },
    });
  }

  async function listInvites(leagueSlug: string) {
    const league = await deps.prisma.league.findUnique({
      where: { slug: leagueSlug },
      select: { id: true },
    });

    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    return deps.prisma.inviteLink.findMany({
      where: { leagueId: league.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function revokeInvite(leagueSlug: string, inviteId: string) {
    const league = await deps.prisma.league.findUnique({
      where: { slug: leagueSlug },
      select: { id: true },
    });
    if (!league) {
      throw new AppError(404, 'NOT_FOUND', 'League not found');
    }

    const invite = await deps.prisma.inviteLink.findFirst({
      where: { id: inviteId, leagueId: league.id },
    });
    if (!invite) {
      throw new AppError(404, 'NOT_FOUND', 'Invite not found');
    }

    return deps.prisma.inviteLink.update({
      where: { id: invite.id },
      data: { status: 'revoked' },
    });
  }

  async function validateInviteToken(token: string) {
    const invite = await deps.prisma.inviteLink.findFirst({
      where: { token },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        },
      },
    });

    if (!invite) {
      throw new AppError(404, 'INVALID_INVITE', 'Invite token is invalid');
    }
    validateInviteState(invite, deps.now());

    return invite;
  }

  async function validateAndJoin(token: string, userId: string) {
    const invite = await validateInviteToken(token);

    await deps.prisma.inviteLink.update({
      where: { id: invite.id },
      data: { useCount: { increment: 1 } },
    });

    await deps.addMember(invite.league.slug, userId);

    return invite.league;
  }

  return {
    createInvite,
    listInvites,
    revokeInvite,
    validateInviteToken,
    validateAndJoin,
  };
}

const defaultInviteService = createInviteService();
export const createInvite = defaultInviteService.createInvite;
export const listInvites = defaultInviteService.listInvites;
export const revokeInvite = defaultInviteService.revokeInvite;
export const validateInviteToken = defaultInviteService.validateInviteToken;
export const validateAndJoin = defaultInviteService.validateAndJoin;
