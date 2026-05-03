import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { addMember } from './leagueService.js';

function generateInviteToken() {
  return crypto.randomBytes(18).toString('base64url');
}

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

export async function createInvite(leagueSlug: string, createdById: string, options: {
  maxUses?: number | null;
  expiresAt?: string | null;
}) {
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  return prisma.inviteLink.create({
    data: {
      leagueId: league.id,
      token: generateInviteToken(),
      createdById,
      maxUses: options.maxUses ?? null,
      expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
    },
  });
}

export async function listInvites(leagueSlug: string) {
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  return prisma.inviteLink.findMany({
    where: { leagueId: league.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeInvite(leagueSlug: string, inviteId: string) {
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });
  if (!league) {
    throw new AppError(404, 'NOT_FOUND', 'League not found');
  }

  const invite = await prisma.inviteLink.findFirst({
    where: { id: inviteId, leagueId: league.id },
  });
  if (!invite) {
    throw new AppError(404, 'NOT_FOUND', 'Invite not found');
  }

  return prisma.inviteLink.update({
    where: { id: invite.id },
    data: { status: 'revoked' },
  });
}

export async function validateInviteToken(token: string) {
  const invite = await prisma.inviteLink.findFirst({
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
  validateInviteState(invite, new Date());

  return invite;
}

export async function validateAndJoin(token: string, userId: string) {
  const invite = await validateInviteToken(token);

  await prisma.inviteLink.update({
    where: { id: invite.id },
    data: { useCount: { increment: 1 } },
  });

  await addMember(invite.league.slug, userId);

  return invite.league;
}
