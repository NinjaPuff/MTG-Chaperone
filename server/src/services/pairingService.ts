import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

type Pair = { player1Id: string; player2Id: string | null; isBye: boolean };

function pairSequential(playerIds: string[]): Pair[] {
  const pairs: Pair[] = [];
  const queue = [...playerIds];
  while (queue.length >= 2) {
    const player1Id = queue.shift()!;
    const player2Id = queue.shift()!;
    pairs.push({ player1Id, player2Id, isBye: false });
  }
  if (queue.length === 1) {
    pairs.push({ player1Id: queue[0], player2Id: null, isBye: true });
  }
  return pairs;
}

async function getSeasonPlayerIdsForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      season: {
        include: {
          league: {
            include: {
              memberships: {
                where: { role: 'player' },
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });
  if (!event) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }
  const ids = event.season.league.memberships.map((membership) => membership.userId);
  return { event, playerIds: ids };
}

export async function generateSwissPairings(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      event: {
        include: {
          season: true,
        },
      },
    },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }

  const standings = await prisma.standing.findMany({
    where: { seasonId: round.event.seasonId },
    orderBy: [{ points: 'desc' }, { omwPercent: 'desc' }, { gwPercent: 'desc' }],
  });

  let orderedPlayers = standings.map((standing) => standing.userId);
  if (orderedPlayers.length === 0) {
    const { playerIds } = await getSeasonPlayerIdsForEvent(round.eventId);
    orderedPlayers = playerIds;
  }

  return pairSequential(orderedPlayers);
}

export async function generateSeededSwissPairings(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { roundNumber: true, eventId: true },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }

  if (round.roundNumber === 1) {
    const { playerIds } = await getSeasonPlayerIdsForEvent(round.eventId);
    return pairSequential(playerIds);
  }

  return generateSwissPairings(roundId);
}

export async function generateRoundRobinSchedule(seasonId: string, playerIds: string[]) {
  await prisma.roundRobinSchedule.deleteMany({ where: { seasonId } });
  const schedule = await prisma.roundRobinSchedule.create({
    data: { seasonId },
  });

  const ids = [...playerIds];
  if (ids.length % 2 === 1) {
    ids.push('BYE');
  }

  const rounds = ids.length - 1;
  const half = ids.length / 2;
  const rotation = [...ids];
  const pairings: Array<{ player1Id: string; player2Id: string }> = [];

  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const p1 = rotation[i];
      const p2 = rotation[rotation.length - 1 - i];
      if (p1 !== 'BYE' && p2 !== 'BYE') {
        pairings.push({ player1Id: p1, player2Id: p2 });
      }
    }
    rotation.splice(1, 0, rotation.pop()!);
  }

  await prisma.scheduledPairing.createMany({
    data: pairings.map((pair) => ({
      scheduleId: schedule.id,
      player1Id: pair.player1Id,
      player2Id: pair.player2Id,
    })),
  });

  return schedule;
}

export async function assignRoundRobinPairings(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { event: { include: { season: true } } },
  });
  if (!round) {
    throw new AppError(404, 'NOT_FOUND', 'Round not found');
  }

  const schedule = await prisma.roundRobinSchedule.findUnique({
    where: { seasonId: round.event.seasonId },
    include: { pairings: true },
  });
  if (!schedule || schedule.pairings.length === 0) {
    const { playerIds } = await getSeasonPlayerIdsForEvent(round.eventId);
    await generateRoundRobinSchedule(round.event.seasonId, playerIds);
  }

  const pairings = await prisma.scheduledPairing.findMany({
    where: { schedule: { seasonId: round.event.seasonId }, roundId: null },
    take: Math.ceil((await getSeasonPlayerIdsForEvent(round.eventId)).playerIds.length / 2),
  });

  const matches = await Promise.all(
    pairings.map((pairing) =>
      prisma.match.create({
        data: {
          roundId,
          player1Id: pairing.player1Id,
          player2Id: pairing.player2Id,
          isBye: false,
        },
      }),
    ),
  );

  await Promise.all(
    pairings.map((pairing) =>
      prisma.scheduledPairing.update({
        where: { id: pairing.id },
        data: { roundId },
      }),
    ),
  );

  return matches;
}

export async function regeneratePairings(roundId: string) {
  await prisma.gameResult.deleteMany({ where: { match: { roundId } } });
  await prisma.match.deleteMany({ where: { roundId } });
}
