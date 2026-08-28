/**
 * Named QA snapshots for AssortedFixesAroundPhase4 manual testing.
 *
 * Usage (repo root):
 *   npx tsx server/scripts/qa-seed.ts load --scenario=archive
 *   npx tsx server/scripts/qa-seed.ts restore
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';
import { createPool } from '../src/services/cardPoolService.js';
import {
  QA_SEED_HELP,
  formatScenariosToon,
  parseQaSeedArgs,
  type QaScenario,
} from '../src/lib/qaSeedCli.js';

const QA_SEASON_NUMBER = 990;
const QA_SEASON_NAME = 'QA Branch Fixes';
const CARA_SLUG = 'qa-cara';
const DAVE_SLUG = 'qa-dave';
const STATE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.qa-seed-state.json');
const MIN_SET_CARDS = 80;
const FALLBACK_SET_CODES = ['FIN', 'EOE', 'ECL', 'DSK', 'OTJ', 'SNC', 'MOM', 'DMU'];
const BASIC_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

type StateFile = { leagueId: string; previousSeasonId: string | null };
type UserRef = { id: string; slug: string; displayName: string };
type Spell = { scryfallId: string; name: string; typeLine: string; colors: string[]; setCode: string };

function printToon(body: string, exitCode = 0): never {
  process.stdout.write(`${body}\n`);
  process.exit(exitCode);
}

function printError(error: string, help = QA_SEED_HELP): never {
  printToon(`error: ${error}\nhelp: ${help}`, 2);
}

async function readState(): Promise<StateFile | null> {
  try {
    const raw = await readFile(STATE_PATH, 'utf8');
    return JSON.parse(raw) as StateFile;
  } catch {
    return null;
  }
}

async function writeState(state: StateFile) {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function resolveLeague(slug: string | null) {
  if (slug) {
    const league = await prisma.league.findUnique({ where: { slug } });
    if (!league) {
      printError(`league slug ${slug} not found`);
    }
    return league;
  }
  const league = await prisma.league.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!league) {
    printError('no league found. Create one in Admin first.');
  }
  return league;
}

async function resolveLoginUser(slug: string | null, role: 'alice' | 'bob', fallback: UserRef | undefined) {
  if (slug) {
    const user = await prisma.user.findUnique({
      where: { slug },
      select: { id: true, slug: true, displayName: true },
    });
    if (!user) {
      printError(`--${role}=${slug} does not match an existing user`);
    }
    return user;
  }
  if (!fallback) {
    printError(`need --${role}=<slug> (not enough league members to auto-pick)`);
  }
  return fallback;
}

async function ensureSynthetic(slug: string, displayName: string, discordId: string): Promise<UserRef> {
  const existing = await prisma.user.findUnique({
    where: { slug },
    select: { id: true, slug: true, displayName: true },
  });
  if (existing) {
    return existing;
  }
  return prisma.user.create({
    data: { slug, displayName, discordId, role: 'user' },
    select: { id: true, slug: true, displayName: true },
  });
}

async function ensureMembership(userId: string, leagueId: string) {
  await prisma.leagueMembership.upsert({
    where: { userId_leagueId: { userId, leagueId } },
    create: { userId, leagueId },
    update: {},
  });
}

function isTokenish(typeLine: string, layout: string | null) {
  const lower = typeLine.toLowerCase();
  return (
    lower.includes('token') ||
    lower.includes('emblem') ||
    layout === 'token' ||
    layout === 'emblem' ||
    layout === 'art_series' ||
    layout === 'double_faced_token'
  );
}

function isBasicLandType(typeLine: string) {
  return typeLine.startsWith('Basic Land');
}

function pickSlice<T>(items: T[], offset: number, count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }
  const result: T[] = [];
  for (let i = 0; i < Math.min(count, items.length); i += 1) {
    result.push(items[(offset + i) % items.length]);
  }
  return result;
}

async function activateQaSeason(leagueId: string) {
  const previous = await prisma.season.findFirst({
    where: { leagueId, isActive: true, number: { not: QA_SEASON_NUMBER } },
    select: { id: true },
  });
  const existingState = await readState();
  if (previous && (!existingState || existingState.previousSeasonId !== previous.id)) {
    await writeState({ leagueId, previousSeasonId: previous.id });
  } else if (!existingState) {
    await writeState({ leagueId, previousSeasonId: previous?.id ?? null });
  }

  await prisma.season.updateMany({ where: { leagueId }, data: { isActive: false } });

  const season =
    (await prisma.season.findUnique({
      where: { leagueId_number: { leagueId, number: QA_SEASON_NUMBER } },
    })) ??
    (await prisma.season.create({
      data: {
        leagueId,
        name: QA_SEASON_NAME,
        number: QA_SEASON_NUMBER,
        isActive: true,
        tradingEnabled: false,
        poolVisibility: true,
        decklistVisibility: true,
        scheduleVisibility: true,
        pointConfig: { create: {} },
      },
    }));

  await prisma.season.update({
    where: { id: season.id },
    data: {
      isActive: true,
      decklistVisibility: true,
      poolVisibility: true,
      name: QA_SEASON_NAME,
    },
  });

  await prisma.event.deleteMany({ where: { seasonId: season.id } });
  await prisma.playerDrop.deleteMany({ where: { seasonId: season.id } });
  return prisma.season.findUniqueOrThrow({ where: { id: season.id } });
}

async function pickProduct() {
  const products = await prisma.boosterProduct.findMany({
    include: { setCodes: true },
    orderBy: { name: 'asc' },
  });
  const setCounts = await prisma.cachedCard.groupBy({ by: ['setCode'], _count: { _all: true } });
  const countBySet = new Map(setCounts.map((row) => [row.setCode, row._count._all]));
  const stocked = products.filter((product) => {
    const total = product.setCodes.reduce((sum, code) => sum + (countBySet.get(code.setCode) ?? 0), 0);
    return total >= MIN_SET_CARDS;
  });
  if (stocked.length === 0) {
    printError('no booster product has enough cached cards. Load a set cache in Admin first.');
  }
  return { product: stocked[0], products: stocked };
}

async function loadSpells(setCodes: string[]): Promise<Spell[]> {
  const bag: Spell[] = [];
  const codes = [...setCodes, ...FALLBACK_SET_CODES.filter((code) => !setCodes.includes(code))];
  for (const setCode of codes) {
    const cards = await prisma.cachedCard.findMany({
      where: { setCode },
      select: { scryfallId: true, name: true, typeLine: true, colors: true, setCode: true, layout: true },
      orderBy: { name: 'asc' },
    });
    bag.push(
      ...cards
        .filter((card) => !isTokenish(card.typeLine, card.layout) && !isBasicLandType(card.typeLine))
        .map(({ layout: _layout, ...card }) => card),
    );
    if (bag.length >= 120) {
      break;
    }
  }
  return [...new Map(bag.map((card) => [card.scryfallId, card])).values()];
}

async function ensurePools(seasonId: string, users: UserRef[], productId: string, setCodes: string[]) {
  const spells = await loadSpells(setCodes);
  if (spells.length < 40) {
    printError('not enough cached non-token cards to fill QA pools.');
  }
  const basics = await prisma.cachedCard.findMany({
    where: { name: { in: [...BASIC_NAMES] } },
    select: { scryfallId: true, name: true, setCode: true },
    orderBy: { lastFetched: 'desc' },
  });
  const basicIds = BASIC_NAMES.map((name) => {
    const match =
      basics.find((card) => card.name === name && FALLBACK_SET_CODES.includes(card.setCode)) ??
      basics.find((card) => card.name === name);
    if (!match) {
      printError(`missing cached basic ${name}`);
    }
    return match.scryfallId;
  });

  for (const [index, user] of users.entries()) {
    let pool = await prisma.cardPool.findUnique({ where: { userId_seasonId: { userId: user.id, seasonId } } });
    if (!pool) {
      await createPool(user.id, seasonId, productId);
      pool = await prisma.cardPool.findUniqueOrThrow({
        where: { userId_seasonId: { userId: user.id, seasonId } },
      });
    }
    await prisma.poolAcquisition.deleteMany({ where: { cardPoolId: pool.id } });
    const acquisition = await prisma.poolAcquisition.create({
      data: { cardPoolId: pool.id, phaseLabel: 'Phase 1', approvalStatus: 'approved' },
    });
    const slice = pickSlice(spells, index * 11, 40);
    await prisma.cardPoolEntry.createMany({
      data: [
        ...slice.map((card, cardIndex) => ({
          acquisitionId: acquisition.id,
          cachedCardId: card.scryfallId,
          quantity: cardIndex < 4 ? 2 : 1,
        })),
        ...basicIds.map((id) => ({
          acquisitionId: acquisition.id,
          cachedCardId: id,
          quantity: 20,
        })),
      ],
    });
  }

  return { spells, basicIds };
}

async function createEvent(params: {
  seasonId: string;
  name: string;
  orderIndex: number;
  status: 'setup' | 'active' | 'completed';
  deckCount?: number;
}) {
  const event = await prisma.event.create({
    data: {
      seasonId: params.seasonId,
      name: params.name,
      orderIndex: params.orderIndex,
      status: params.status,
      config: {
        create: {
          format: 'swiss',
          bestOfN: 3,
          deckCount: params.deckCount ?? 2,
          minDeckSize: 40,
          sideboardRule: 'entire_pool',
          schedulingType: 'open_window',
          deckLockingMode: 'free_modification',
        },
      },
    },
  });
  return event;
}

async function createRound(
  eventId: string,
  roundNumber: number,
  status: 'not_started' | 'in_progress' | 'completed',
) {
  return prisma.round.create({
    data: { eventId, roundNumber, status },
  });
}

async function writeDeck(params: {
  userId: string;
  eventId: string;
  roundId: string;
  orderIndex: number;
  name: string;
  status: 'draft' | 'submitted' | 'locked';
  spells: Spell[];
  basicId: string;
  mainSize: number;
}) {
  const deck = await prisma.decklist.create({
    data: {
      userId: params.userId,
      eventId: params.eventId,
      roundId: params.roundId,
      orderIndex: params.orderIndex,
      name: params.name,
      status: params.status,
    },
  });
  if (params.mainSize <= 0) {
    return deck;
  }
  const spellTake = Math.min(params.spells.length, Math.max(8, params.mainSize - 17));
  await prisma.decklistEntry.createMany({
    data: [
      ...params.spells.slice(0, spellTake).map((card) => ({
        decklistId: deck.id,
        cachedCardId: card.scryfallId,
        quantity: 1,
        zone: 'main' as const,
      })),
      {
        decklistId: deck.id,
        cachedCardId: params.basicId,
        quantity: Math.max(1, params.mainSize - spellTake),
        zone: 'main' as const,
      },
    ],
  });
  return deck;
}

async function confirmMatch(params: {
  roundId: string;
  player1Id: string;
  player2Id: string;
  outcome: 'draw' | 'p1' | 'pending';
}) {
  const match = await prisma.match.create({
    data: {
      roundId: params.roundId,
      player1Id: params.player1Id,
      player2Id: params.player2Id,
      isBye: false,
      status: params.outcome === 'pending' ? 'pending' : 'confirmed',
      reportedById: params.outcome === 'pending' ? null : params.player1Id,
      confirmedAt: params.outcome === 'pending' ? null : new Date(),
    },
  });
  if (params.outcome === 'pending') {
    return match;
  }
  const g1 = params.outcome === 'draw' ? params.player1Id : params.player1Id;
  const g2 = params.outcome === 'draw' ? params.player2Id : params.player1Id;
  await prisma.gameResult.createMany({
    data: [
      { matchId: match.id, gameNumber: 1, winnerId: g1, isDraw: false },
      { matchId: match.id, gameNumber: 2, winnerId: g2, isDraw: false },
    ],
  });
  return match;
}

async function seedScenario(
  scenario: QaScenario,
  seasonId: string,
  actors: { alice: UserRef; bob: UserRef; cara: UserRef; dave: UserRef },
  spells: Spell[],
  basicIds: string[],
) {
  const includeWeek1 = true;
  const includeWeek2 = scenario !== 'archive';
  const includeWeek3 = scenario === 'carry-forward';
  const week1Status = 'completed' as const;
  const week2Status = scenario === 'carry-forward' ? ('completed' as const) : ('active' as const);
  const visibilityOff = scenario === 'privacy-off';
  const matchesDone = scenario === 'matches-complete' || scenario === 'carry-forward';
  const registerAlice = scenario !== 'archive' && scenario !== 'builder-draft';
  const registerBobPartial = scenario === 'deck-checks' || scenario === 'privacy-off';
  const registerBobFull =
    scenario === 'matches-complete' || scenario === 'carry-forward' || scenario === 'builder-draft';

  await prisma.season.update({
    where: { id: seasonId },
    data: { decklistVisibility: !visibilityOff },
  });

  const week1 = includeWeek1
    ? await createEvent({ seasonId, name: 'QA Week 1', orderIndex: 1, status: week1Status })
    : null;
  const week1Round = week1 ? await createRound(week1.id, 1, 'completed') : null;

  if (week1 && week1Round) {
    const aliceSpells = pickSlice(spells, 0, 24);
    const bobSpells = pickSlice(spells, 8, 24);
    await writeDeck({
      userId: actors.alice.id,
      eventId: week1.id,
      roundId: week1Round.id,
      orderIndex: 0,
      name: 'Alice Aggro',
      status: 'submitted',
      spells: aliceSpells,
      basicId: basicIds[3],
      mainSize: 40,
    });
    await writeDeck({
      userId: actors.alice.id,
      eventId: week1.id,
      roundId: week1Round.id,
      orderIndex: 1,
      name: 'Alice Midrange',
      status: 'locked',
      spells: pickSlice(spells, 4, 24),
      basicId: basicIds[1],
      mainSize: 40,
    });
    await writeDeck({
      userId: actors.alice.id,
      eventId: week1.id,
      roundId: week1Round.id,
      orderIndex: 2,
      name: 'Alice Notes',
      status: 'draft',
      spells: pickSlice(spells, 12, 16),
      basicId: basicIds[0],
      mainSize: 22,
    });
    await writeDeck({
      userId: actors.bob.id,
      eventId: week1.id,
      roundId: week1Round.id,
      orderIndex: 0,
      name: 'Bob Tempo',
      status: 'submitted',
      spells: bobSpells,
      basicId: basicIds[1],
      mainSize: 40,
    });
    await writeDeck({
      userId: actors.bob.id,
      eventId: week1.id,
      roundId: week1Round.id,
      orderIndex: 1,
      name: 'Bob Control',
      status: 'submitted',
      spells: pickSlice(spells, 16, 24),
      basicId: basicIds[2],
      mainSize: 40,
    });
    await writeDeck({
      userId: actors.cara.id,
      eventId: week1.id,
      roundId: week1Round.id,
      orderIndex: 0,
      name: 'Cara Scratch',
      status: 'draft',
      spells: pickSlice(spells, 20, 16),
      basicId: basicIds[4],
      mainSize: 28,
    });
  }

  if (!includeWeek2 || !week1) {
    return { week2EventId: null as string | null };
  }

  const week2 = await createEvent({
    seasonId,
    name: 'QA Week 2',
    orderIndex: 2,
    status: week2Status,
  });
  const week2Round = await createRound(
    week2.id,
    1,
    week2Status === 'completed' ? 'completed' : 'in_progress',
  );

  const aliceStatus = registerAlice ? 'submitted' : 'draft';
  await writeDeck({
    userId: actors.alice.id,
    eventId: week2.id,
    roundId: week2Round.id,
    orderIndex: 0,
    name: 'Alice Week2 A',
    status: aliceStatus,
    spells: pickSlice(spells, 1, 23),
    basicId: basicIds[3],
    mainSize: scenario === 'builder-draft' ? 24 : 40,
  });
  await writeDeck({
    userId: actors.alice.id,
    eventId: week2.id,
    roundId: week2Round.id,
    orderIndex: 1,
    name: scenario === 'builder-draft' ? 'Alice Week2 Empty' : 'Alice Week2 B',
    status: aliceStatus,
    spells: scenario === 'builder-draft' ? [] : pickSlice(spells, 6, 23),
    basicId: basicIds[1],
    mainSize: scenario === 'builder-draft' ? 0 : 40,
  });
  await writeDeck({
    userId: actors.alice.id,
    eventId: week2.id,
    roundId: week2Round.id,
    orderIndex: 2,
    name: 'Alice Extra',
    status: 'draft',
    spells: scenario === 'builder-draft' ? [] : pickSlice(spells, 9, 10),
    basicId: basicIds[0],
    mainSize: scenario === 'builder-draft' ? 0 : 18,
  });

  const bobFirstStatus = 'submitted';
  const bobSecondStatus = registerBobPartial ? 'draft' : registerBobFull ? 'submitted' : 'draft';
  await writeDeck({
    userId: actors.bob.id,
    eventId: week2.id,
    roundId: week2Round.id,
    orderIndex: 0,
    name: 'Bob Week2 A',
    status: bobFirstStatus,
    spells: pickSlice(spells, 10, 23),
    basicId: basicIds[1],
    mainSize: 40,
  });
  await writeDeck({
    userId: actors.bob.id,
    eventId: week2.id,
    roundId: week2Round.id,
    orderIndex: 1,
    name: 'Bob Week2 B',
    status: bobSecondStatus,
    spells: pickSlice(spells, 14, 23),
    basicId: basicIds[2],
    mainSize: registerBobPartial ? 12 : 40,
  });

  await confirmMatch({
    roundId: week2Round.id,
    player1Id: actors.alice.id,
    player2Id: actors.bob.id,
    outcome: matchesDone ? 'draw' : 'pending',
  });
  await confirmMatch({
    roundId: week2Round.id,
    player1Id: actors.cara.id,
    player2Id: actors.dave.id,
    outcome: matchesDone ? 'p1' : 'pending',
  });

  if (includeWeek3) {
    const week3 = await createEvent({
      seasonId,
      name: 'QA Week 3',
      orderIndex: 3,
      status: 'active',
    });
    const week3Round = await createRound(week3.id, 1, 'in_progress');
    await writeDeck({
      userId: actors.alice.id,
      eventId: week3.id,
      roundId: week3Round.id,
      orderIndex: 0,
      name: 'Alice Week3 A',
      status: 'draft',
      spells: pickSlice(spells, 2, 20),
      basicId: basicIds[3],
      mainSize: 40,
    });
    await prisma.decklist.updateMany({
      where: { userId: actors.alice.id, eventId: week2.id, orderIndex: { gte: 2 } },
      data: { eventId: week3.id, roundId: week3Round.id },
    });
  }

  return { week2EventId: week2.id };
}

async function load(args: {
  scenario: QaScenario;
  alice: string | null;
  bob: string | null;
  league: string | null;
}) {
  const league = await resolveLeague(args.league);
  const members = await prisma.leagueMembership.findMany({
    where: { leagueId: league.id },
    include: { user: { select: { id: true, slug: true, displayName: true } } },
    orderBy: { user: { displayName: 'asc' } },
  });
  const realMembers = members
    .map((row) => row.user)
    .filter((user) => user.slug !== CARA_SLUG && user.slug !== DAVE_SLUG);
  const admins = await prisma.user.findMany({
    where: { role: 'admin', id: { in: realMembers.map((user) => user.id) } },
    select: { id: true, slug: true, displayName: true },
  });
  const alice = await resolveLoginUser(args.alice, 'alice', admins[0] ?? realMembers[0]);
  const preferredBob =
    realMembers.find((user) => user.slug === 'scott-harris' && user.id !== alice.id) ??
    realMembers.find((user) => user.id !== alice.id);
  const bob = await resolveLoginUser(args.bob, 'bob', preferredBob);
  if (alice.id === bob.id) {
    printError('alice and bob must be different users');
  }
  const cara = await ensureSynthetic(CARA_SLUG, 'QA Cara', '0000000000000000c1');
  const dave = await ensureSynthetic(DAVE_SLUG, 'QA Dave', '0000000000000000d1');
  for (const user of [alice, bob, cara, dave]) {
    await ensureMembership(user.id, league.id);
  }

  const { product } = await pickProduct();
  const season = await activateQaSeason(league.id);
  const setCodes = product.setCodes.map((code) => code.setCode);
  const roster = await prisma.leagueMembership.findMany({
    where: { leagueId: league.id },
    include: { user: { select: { id: true, slug: true, displayName: true } } },
    orderBy: { user: { displayName: 'asc' } },
  });
  const { spells, basicIds } = await ensurePools(
    season.id,
    roster.map((row) => row.user),
    product.id,
    setCodes,
  );
  const seeded = await seedScenario(
    args.scenario,
    season.id,
    { alice, bob, cara, dave },
    spells,
    basicIds,
  );

  printToon(
    [
      'qa-seed:',
      `  status: loaded`,
      `  scenario: ${args.scenario}`,
      `  league: ${league.slug}`,
      `  season: ${season.name} (#${season.number})`,
      `  alice: ${alice.slug}`,
      `  bob: ${bob.slug}`,
      `  cara: ${cara.slug}`,
      `  dave: ${dave.slug}`,
      `  pools: ${roster.length}`,
      `  week2EventId: ${seeded.week2EventId ?? 'none'}`,
      `  decklistVisibility: ${args.scenario === 'privacy-off' ? 'false' : 'true'}`,
      'help: Sign in as alice/bob. Guest = private window. Restore with npx tsx server/scripts/qa-seed.ts restore',
    ].join('\n'),
  );
}

async function restore(leagueSlug: string | null) {
  const league = await resolveLeague(leagueSlug);
  const state = await readState();
  const qa = await prisma.season.findUnique({
    where: { leagueId_number: { leagueId: league.id, number: QA_SEASON_NUMBER } },
  });
  if (qa) {
    await prisma.season.update({ where: { id: qa.id }, data: { isActive: false } });
  }
  if (state?.previousSeasonId) {
    await prisma.season.updateMany({ where: { leagueId: league.id }, data: { isActive: false } });
    await prisma.season.update({
      where: { id: state.previousSeasonId },
      data: { isActive: true },
    });
  }
  printToon(
    [
      'qa-seed:',
      '  status: restored',
      `  league: ${league.slug}`,
      `  activeSeasonId: ${state?.previousSeasonId ?? 'none'}`,
      'help: QA season 990 is inactive. Reload the app.',
    ].join('\n'),
  );
}

async function main() {
  const parsed = parseQaSeedArgs(process.argv.slice(2));
  if (!parsed.ok) {
    printError(parsed.error, parsed.help);
  }
  if (parsed.command === 'help') {
    printToon(QA_SEED_HELP);
  }
  if (parsed.command === 'scenarios') {
    printToon(formatScenariosToon());
  }
  if (parsed.command === 'restore') {
    await restore(parsed.league);
    return;
  }
  if (parsed.command === 'load') {
    await load(parsed);
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`error: ${message}\nhelp: ${QA_SEED_HELP}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
