/**
 * Dev helper: fills every league member's empty pool and seeds previous-round
 * decklists on completed events so /decks has a real archive to browse.
 *
 * Leftover `draft` decks are still seeded for owners to see in the builder /
 * “Your previous decks”, but they are owner-visible only (not the public archive).
 *
 * Usage (from repo root):
 *   npx tsx server/scripts/seed-previous-round-archive-demo.ts
 */
import '../src/load-env.js';
import { prisma } from '../src/lib/prisma.js';
import { createPool } from '../src/services/cardPoolService.js';

const BASIC_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;
type Color = 'W' | 'U' | 'B' | 'R' | 'G';

const PLAYER_ARCHETYPES: Record<
  string,
  { colors: Color[]; registeredName: string; leftoverName: string }
> = {
  ninjapuff: { colors: ['R', 'B'], registeredName: 'Ninja Aggro', leftoverName: 'Side Experiments' },
  dragonslayer42: { colors: ['R'], registeredName: 'Dragon Rush', leftoverName: 'Dragon Scratchpad' },
  'manaflood-mike': { colors: ['U'], registeredName: 'Flood Control', leftoverName: 'Island Pile' },
  topdeckqueen: { colors: ['W'], registeredName: 'Topdeck Angels', leftoverName: 'White Sketch' },
  'counterspell-carl': { colors: ['U'], registeredName: 'Counterspell Stack', leftoverName: 'Blue Brainstorm' },
  'milldeck-molly': { colors: ['U', 'B'], registeredName: 'Mill Clock', leftoverName: 'Graveyard Notes' },
  tokentina: { colors: ['G', 'W'], registeredName: 'Token Swarm', leftoverName: 'Go-Wide Draft' },
  boltbrian: { colors: ['R'], registeredName: 'Bolt the Bird', leftoverName: 'Burn Leftovers' },
  'bracket-player-9': { colors: ['B'], registeredName: 'Black Midrange', leftoverName: 'Swamp Scratch' },
  'bracket-player-10': { colors: ['G'], registeredName: 'Green Stompy', leftoverName: 'Ramp Notes' },
  'scott-harris': { colors: ['W', 'U'], registeredName: 'Azorius Tempo', leftoverName: 'UW Sketch' },
};

const COLOR_TO_BASIC: Record<Color, (typeof BASIC_NAMES)[number]> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

const FALLBACK_SET_CODES = ['FIN', 'EOE', 'ECL', 'DSK', 'OTJ', 'SNC', 'MOM', 'DMU'];
const MIN_SET_CARDS = 80;

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

function hashOffset(slug: string, salt: number) {
  let value = salt;
  for (const char of slug) {
    value = (value * 31 + char.charCodeAt(0)) >>> 0;
  }
  return value;
}

function pickSlice<T>(items: T[], offset: number, count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }
  const start = offset % items.length;
  const result: T[] = [];
  for (let i = 0; i < Math.min(count, items.length); i += 1) {
    result.push(items[(start + i) % items.length]);
  }
  return result;
}

async function ensureScottMembership(leagueId: string, seasonId: string, productId: string) {
  const scott = await prisma.user.findUnique({ where: { slug: 'scott-harris' } });
  if (!scott) {
    return null;
  }
  await prisma.leagueMembership.upsert({
    where: { userId_leagueId: { userId: scott.id, leagueId } },
    create: { userId: scott.id, leagueId },
    update: {},
  });
  const pool = await prisma.cardPool.findUnique({
    where: { userId_seasonId: { userId: scott.id, seasonId } },
  });
  if (!pool) {
    await createPool(scott.id, seasonId, productId);
    console.log(`Added Scott Harris to the league and assigned a pool.`);
  }
  return scott;
}

async function main() {
  const league = await prisma.league.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      memberships: {
        include: { user: { select: { id: true, slug: true, displayName: true } } },
      },
      seasons: {
        where: { isActive: true },
        take: 1,
        include: {
          events: {
            orderBy: { orderIndex: 'asc' },
            include: {
              rounds: { orderBy: { roundNumber: 'asc' } },
            },
          },
        },
      },
    },
  });

  if (!league) {
    console.error('No league found.');
    process.exit(1);
  }

  const season = league.seasons[0];
  if (!season) {
    console.error('No active season.');
    process.exit(1);
  }

  const products = await prisma.boosterProduct.findMany({
    include: { setCodes: true },
    orderBy: { name: 'asc' },
  });
  const setCounts = await prisma.cachedCard.groupBy({
    by: ['setCode'],
    _count: { _all: true },
  });
  const countBySet = new Map(setCounts.map((row) => [row.setCode, row._count._all]));

  const stockedProducts = products.filter((product) => {
    const total = product.setCodes.reduce((sum, code) => sum + (countBySet.get(code.setCode) ?? 0), 0);
    return total >= MIN_SET_CARDS;
  });
  if (stockedProducts.length === 0) {
    console.error('No booster products have enough cached cards to seed pools.');
    process.exit(1);
  }

  await ensureScottMembership(league.id, season.id, stockedProducts[0].id);

  const members = await prisma.leagueMembership.findMany({
    where: { leagueId: league.id },
    include: { user: { select: { id: true, slug: true, displayName: true } } },
    orderBy: { user: { displayName: 'asc' } },
  });

  const basics = await prisma.cachedCard.findMany({
    where: { name: { in: [...BASIC_NAMES] } },
    select: { scryfallId: true, name: true, setCode: true, typeLine: true },
    orderBy: { lastFetched: 'desc' },
  });
  const basicByName = new Map<string, string>();
  for (const name of BASIC_NAMES) {
    const match = basics.find((card) => card.name === name && FALLBACK_SET_CODES.includes(card.setCode)) ?? basics.find((card) => card.name === name);
    if (match) {
      basicByName.set(name, match.scryfallId);
    }
  }
  if (basicByName.size < BASIC_NAMES.length) {
    console.error('Missing cached basic lands.');
    process.exit(1);
  }

  const cardsBySet = new Map<string, Array<{
    scryfallId: string;
    name: string;
    typeLine: string;
    colors: string[];
    setCode: string;
  }>>();

  async function loadSetCards(setCode: string) {
    const existing = cardsBySet.get(setCode);
    if (existing) {
      return existing;
    }
    const cards = await prisma.cachedCard.findMany({
      where: { setCode },
      select: { scryfallId: true, name: true, typeLine: true, colors: true, setCode: true, layout: true },
      orderBy: { name: 'asc' },
    });
    const usable = cards.filter((card) => !isTokenish(card.typeLine, card.layout) && !isBasicLandType(card.typeLine));
    cardsBySet.set(setCode, usable);
    return usable;
  }

  function productSetCodes(productId: string) {
    return products.find((product) => product.id === productId)?.setCodes.map((code) => code.setCode) ?? [];
  }

  async function pickPoolCards(setCodes: string[], slug: string, count: number) {
    const bag: Array<{ scryfallId: string; name: string; typeLine: string; colors: string[]; setCode: string }> = [];
    for (const setCode of setCodes) {
      bag.push(...(await loadSetCards(setCode)));
    }
    if (bag.length < 40) {
      for (const fallback of FALLBACK_SET_CODES) {
        if (!setCodes.includes(fallback)) {
          bag.push(...(await loadSetCards(fallback)));
        }
        if (bag.length >= 80) {
          break;
        }
      }
    }
    const unique = [...new Map(bag.map((card) => [card.scryfallId, card])).values()];
    return pickSlice(unique, hashOffset(slug, 7), count);
  }

  for (const [index, membership] of members.entries()) {
    const user = membership.user;
    let pool = await prisma.cardPool.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      include: {
        boosterProduct: { include: { setCodes: true } },
        acquisitions: { include: { _count: { select: { entries: true } } } },
      },
    });

    if (!pool) {
      const product = stockedProducts[index % stockedProducts.length];
      await createPool(user.id, season.id, product.id);
      pool = await prisma.cardPool.findUnique({
        where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
        include: {
          boosterProduct: { include: { setCodes: true } },
          acquisitions: { include: { _count: { select: { entries: true } } } },
        },
      });
      console.log(`Created pool for ${user.displayName}: ${product.name}`);
    }

    if (!pool) {
      throw new Error(`Failed to load pool for ${user.slug}`);
    }

    const entryCount = pool.acquisitions.reduce((sum, acq) => sum + acq._count.entries, 0);
    const productCardTotal = productSetCodes(pool.boosterProductId).reduce(
      (sum, code) => sum + (countBySet.get(code) ?? 0),
      0,
    );

    if (entryCount === 0 && productCardTotal < MIN_SET_CARDS) {
      const replacement = stockedProducts[index % stockedProducts.length];
      await prisma.cardPool.update({
        where: { id: pool.id },
        data: { boosterProductId: replacement.id },
      });
      pool.boosterProductId = replacement.id;
      console.log(`Reassigned ${user.displayName} to ${replacement.name} (previous product had too few cached cards).`);
    }

    if (entryCount === 0) {
      const cards = await pickPoolCards(productSetCodes(pool.boosterProductId), user.slug, 96);
      const acquisition = await prisma.poolAcquisition.create({
        data: {
          cardPoolId: pool.id,
          phaseLabel: 'Phase 1',
          approvalStatus: 'approved',
        },
      });
      await prisma.cardPoolEntry.createMany({
        data: cards.map((card) => ({
          acquisitionId: acquisition.id,
          cachedCardId: card.scryfallId,
          quantity: 1,
        })),
      });
      console.log(`Filled pool for ${user.displayName} with ${cards.length} cards.`);
    } else {
      console.log(`${user.displayName} already has ${entryCount} pool cards.`);
    }
  }

  const completedEvents = season.events.filter(
    (event) => event.status === 'completed' && event.rounds.some((round) => round.status === 'completed'),
  );
  if (completedEvents.length === 0) {
    console.error('No completed events/rounds to seed archive decks onto.');
    process.exit(1);
  }

  const refreshedMembers = await prisma.leagueMembership.findMany({
    where: { leagueId: league.id },
    include: { user: { select: { id: true, slug: true, displayName: true } } },
    orderBy: { user: { displayName: 'asc' } },
  });

  let createdDecks = 0;
  let skippedDecks = 0;

  for (const [memberIndex, membership] of refreshedMembers.entries()) {
    const user = membership.user;
    const archetype = PLAYER_ARCHETYPES[user.slug] ?? {
      colors: ([['W'], ['U'], ['B'], ['R'], ['G']] as Color[][])[memberIndex % 5],
      registeredName: `${user.displayName} List`,
      leftoverName: `${user.displayName} Notes`,
    };

    const pool = await prisma.cardPool.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      include: {
        acquisitions: {
          include: {
            entries: {
              include: {
                cachedCard: {
                  select: { scryfallId: true, name: true, typeLine: true, colors: true },
                },
              },
            },
          },
        },
      },
    });
    if (!pool) {
      continue;
    }

    const poolSpells = pool.acquisitions
      .flatMap((acq) => acq.entries.map((entry) => entry.cachedCard))
      .filter((card) => !isBasicLandType(card.typeLine));

    const colorMatched = poolSpells.filter(
      (card) => card.colors.length === 0 || card.colors.some((color) => archetype.colors.includes(color as Color)),
    );
    const spellBag = colorMatched.length >= 24 ? colorMatched : poolSpells;

    for (const event of completedEvents) {
      const completedRounds = event.rounds.filter((round) => round.status === 'completed');
      for (const round of completedRounds) {
        const existing = await prisma.decklist.findMany({
          where: { userId: user.id, eventId: event.id, roundId: round.id },
          select: { orderIndex: true },
        });
        const existingSlots = new Set(existing.map((deck) => deck.orderIndex));

        const neverRegistered =
          user.slug === 'tokentina' && event.orderIndex === 1
          || user.slug === 'boltbrian' && event.orderIndex === 2 && round.roundNumber === 1
          || user.slug === 'milldeck-molly' && event.orderIndex === 2 && round.roundNumber === 3;

        const extraLeftover =
          user.slug === 'counterspell-carl' && event.orderIndex === 1 && round.roundNumber === 1
          || user.slug === 'dragonslayer42' && event.orderIndex === 2 && round.roundNumber === 2;

        const spellOffset = hashOffset(user.slug, event.orderIndex * 10 + round.roundNumber);
        const registeredSpells = pickSlice(spellBag, spellOffset, 23);
        const leftoverSpells = pickSlice(spellBag, spellOffset + 19, 16);

        async function writeDeck(params: {
          orderIndex: number;
          name: string;
          status: 'draft' | 'submitted' | 'locked';
          spells: typeof spellBag;
          mainSize: number;
        }) {
          if (existingSlots.has(params.orderIndex)) {
            skippedDecks += 1;
            return;
          }
          const landNeed = Math.max(0, params.mainSize - params.spells.length);
          const landShare = Math.max(1, Math.floor(landNeed / archetype.colors.length));
          const entries: Array<{ cachedCardId: string; quantity: number; zone: 'main' | 'side' }> = params.spells.map(
            (card) => ({
              cachedCardId: card.scryfallId,
              quantity: 1,
              zone: 'main',
            }),
          );
          let remainingLands = landNeed;
          for (const [colorIndex, color] of archetype.colors.entries()) {
            const qty = colorIndex === archetype.colors.length - 1 ? remainingLands : landShare;
            remainingLands -= qty;
            if (qty <= 0) {
              continue;
            }
            entries.push({
              cachedCardId: basicByName.get(COLOR_TO_BASIC[color])!,
              quantity: qty,
              zone: 'main',
            });
          }

          const deck = await prisma.decklist.create({
            data: {
              userId: user.id,
              eventId: event.id,
              roundId: round.id,
              orderIndex: params.orderIndex,
              name: `${params.name} R${round.roundNumber}`,
              status: params.status,
            },
          });
          await prisma.decklistEntry.createMany({
            data: entries.map((entry) => ({
              decklistId: deck.id,
              cachedCardId: entry.cachedCardId,
              quantity: entry.quantity,
              zone: entry.zone,
            })),
          });
          createdDecks += 1;
        }

        if (neverRegistered) {
          await writeDeck({
            orderIndex: 0,
            name: archetype.leftoverName,
            status: 'draft',
            spells: leftoverSpells,
            mainSize: 28,
          });
        } else {
          await writeDeck({
            orderIndex: 0,
            name: archetype.registeredName,
            status: 'submitted',
            spells: registeredSpells,
            mainSize: 40,
          });
          if (extraLeftover) {
            await writeDeck({
              orderIndex: 1,
              name: archetype.leftoverName,
              status: 'draft',
              spells: leftoverSpells,
              mainSize: 22,
            });
          }
        }
      }
    }
  }

  console.log(`\nDone. Created ${createdDecks} previous-round decklist(s); skipped ${skippedDecks} existing slot(s).`);
  console.log(`Open ${process.env.CLIENT_URL ?? 'http://localhost:5173'}/decks`);
  console.log(`League: ${league.name} | ${season.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
