import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

const pairingMocks = vi.hoisted(() => ({
  assignRoundRobinPairings: vi.fn(),
  generateSeededSwissPairings: vi.fn(),
  generateSwissPairings: vi.fn(),
}));

const roundServiceMocks = vi.hoisted(() => ({
  resetRoundProgress: vi.fn(),
}));

const bracketServiceMocks = vi.hoisted(() => ({
  initializeBracket: vi.fn(),
  resetBracketEvent: vi.fn(),
  ensureBracketSeeds: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../services/pairingService.js', () => pairingMocks);
vi.mock('../../services/roundService.js', () => roundServiceMocks);
vi.mock('../../services/bracketService.js', () => bracketServiceMocks);

import { completeEvent, resetEvent, startEvent, updateEvent } from '../../services/eventService.js';

describe('eventService', () => {
  beforeEach(() => {
    resetPrismaMock();
    pairingMocks.assignRoundRobinPairings.mockReset();
    pairingMocks.generateSeededSwissPairings.mockReset();
    pairingMocks.generateSwissPairings.mockReset();
    roundServiceMocks.resetRoundProgress.mockReset();
    bracketServiceMocks.initializeBracket.mockReset();
    bracketServiceMocks.resetBracketEvent.mockReset();
    bracketServiceMocks.ensureBracketSeeds.mockReset();
  });

  it('starts setup events when no other active event exists', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      status: 'setup',
      totalRounds: null,
      config: { format: 'swiss' },
      season: { leagueId: 'l1' },
    });
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.leagueMembership.count.mockResolvedValue(8);
    prismaMock.round.count.mockResolvedValue(0);
    prismaMock.event.update.mockResolvedValue({ id: 'e1', status: 'active', config: {} });

    const result = await startEvent('e1');

    expect(result.status).toBe('active');
    expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
      where: {
        seasonId: 's1',
        status: 'active',
        id: { not: 'e1' },
      },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: 'active', totalRounds: 3 },
      include: { config: true },
    });
  });

  it('initializes brackets when starting bracket-format events', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      status: 'setup',
      totalRounds: null,
      config: { format: 'custom_10_player' },
      season: { leagueId: 'l1' },
    });
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.leagueMembership.count.mockResolvedValue(10);
    prismaMock.round.count.mockResolvedValue(0);
    prismaMock.event.update.mockResolvedValue({ id: 'e1', status: 'active', config: { format: 'custom_10_player' } });
    bracketServiceMocks.ensureBracketSeeds.mockResolvedValue([]);

    await startEvent('e1');

    expect(bracketServiceMocks.ensureBracketSeeds).toHaveBeenCalledWith('e1');
    expect(bracketServiceMocks.initializeBracket).toHaveBeenCalledWith('e1');
  });

  it('rolls bracket events back to setup when initialization fails', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      status: 'setup',
      totalRounds: null,
      config: { format: 'custom_10_player' },
      season: { leagueId: 'l1' },
    });
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.leagueMembership.count.mockResolvedValue(10);
    prismaMock.round.count.mockResolvedValue(0);
    prismaMock.event.update
      .mockResolvedValueOnce({ id: 'e1', status: 'active', config: { format: 'custom_10_player' } })
      .mockResolvedValueOnce({ id: 'e1', status: 'setup', totalRounds: null });
    bracketServiceMocks.ensureBracketSeeds.mockResolvedValue([]);
    bracketServiceMocks.initializeBracket.mockRejectedValue(new Error('init failed'));

    await expect(startEvent('e1')).rejects.toThrow('init failed');

    expect(prismaMock.event.update).toHaveBeenLastCalledWith({
      where: { id: 'e1' },
      data: { status: 'setup', totalRounds: null },
    });
  });

  it('blocks bracket start when seed resolution fails before activation', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      seasonId: 's1',
      status: 'setup',
      totalRounds: null,
      config: { format: 'custom_10_player', seedingSource: 'previous_season' },
      season: { leagueId: 'l1' },
    });
    prismaMock.event.findFirst.mockResolvedValue(null);
    prismaMock.leagueMembership.count.mockResolvedValue(10);
    prismaMock.round.count.mockResolvedValue(0);
    bracketServiceMocks.ensureBracketSeeds.mockRejectedValue({
      code: 'SEEDING_SOURCE_UNAVAILABLE',
      message: 'No previous inactive season found for seeding',
    });

    await expect(startEvent('e1')).rejects.toMatchObject({
      code: 'SEEDING_SOURCE_UNAVAILABLE',
    });
    expect(prismaMock.event.update).not.toHaveBeenCalled();
    expect(bracketServiceMocks.initializeBracket).not.toHaveBeenCalled();
  });

  it('blocks completion when event has unfinished rounds', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'active',
      rounds: [{ status: 'in_progress' }],
    });

    await expect(completeEvent('e1')).rejects.toMatchObject({
      code: 'ROUND_INCOMPLETE',
      message: 'All rounds must be completed first',
    });
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });

  it('allows updating setup events', async () => {
    prismaMock.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'setup',
        name: 'Week 1',
        pointMultiplier: 1,
        standingsOverride: false,
        config: {
          format: 'swiss',
          bestOfN: 3,
          deckCount: 1,
          minDeckSize: 40,
          sideboardRule: 'entire_pool',
          schedulingType: 'open_window',
          deckLockingMode: 'free_modification',
          seedingSource: null,
          grandFinalsReset: false,
        },
      })
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'setup',
        name: 'Week 1 updated',
        pointMultiplier: 1.5,
        standingsOverride: false,
        config: {
          format: 'swiss',
          bestOfN: 3,
          deckCount: 2,
          minDeckSize: 40,
          sideboardRule: 'entire_pool',
          schedulingType: 'open_window',
          deckLockingMode: 'free_modification',
          seedingSource: null,
          grandFinalsReset: false,
        },
        rounds: [],
        season: {
          id: 's1',
          league: {
            id: 'l1',
            slug: 'league',
            memberships: [],
          },
        },
      });
    prismaMock.decklist.findMany.mockResolvedValue([]);
    prismaMock.event.update.mockResolvedValue({ id: 'e1' });
    prismaMock.eventConfig.update.mockResolvedValue({ eventId: 'e1' });

    const result = await updateEvent('e1', {
      name: 'Week 1 updated',
      pointMultiplier: 1.5,
      config: { deckCount: 2 },
    });

    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: {
        name: 'Week 1 updated',
        pointMultiplier: 1.5,
        standingsOverride: false,
      },
    });
    expect(prismaMock.eventConfig.update).toHaveBeenCalledWith({
      where: { eventId: 'e1' },
      data: expect.objectContaining({ deckCount: 2 }),
    });
    expect(result.id).toBe('e1');
  });

  it('blocks updating active events', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'active',
      name: 'Week 1',
      pointMultiplier: 1,
      standingsOverride: false,
      config: { format: 'swiss' },
    });

    await expect(updateEvent('e1', { name: 'New name' })).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Only setup events can be edited',
    });
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });

  it("blocks lowering deck count below a player's registered decks", async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'setup',
      name: 'Week 1',
      pointMultiplier: 1,
      standingsOverride: false,
      config: {
        format: 'swiss',
        bestOfN: 3,
        deckCount: 2,
        minDeckSize: 40,
        sideboardRule: 'entire_pool',
        schedulingType: 'open_window',
        deckLockingMode: 'free_modification',
        seedingSource: null,
        grandFinalsReset: false,
      },
    });
    prismaMock.decklist.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u1' },
      { userId: 'u2' },
    ]);

    await expect(
      updateEvent('e1', {
        config: { deckCount: 1 },
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
    });
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });

  it('blocks changing format when rounds already have matches', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'setup',
      name: 'Week 1',
      pointMultiplier: 1,
      standingsOverride: false,
      config: {
        format: 'swiss',
        bestOfN: 3,
        deckCount: 2,
        minDeckSize: 40,
        sideboardRule: 'entire_pool',
        schedulingType: 'open_window',
        deckLockingMode: 'free_modification',
        seedingSource: null,
        grandFinalsReset: false,
      },
    });
    prismaMock.round.findFirst.mockResolvedValue({ id: 'r1' });

    await expect(
      updateEvent('e1', {
        config: { format: 'seeded_swiss' },
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Format cannot be changed after pairings are generated',
    });
    expect(prismaMock.eventConfig.update).not.toHaveBeenCalled();
  });

  it('resets active events back to setup and null totalRounds', async () => {
    prismaMock.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'active',
        config: { format: 'swiss' },
        rounds: [
          { id: 'r1', status: 'completed', matches: [{ id: 'm1' }] },
          { id: 'r2', status: 'not_started', matches: [] },
        ],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'setup',
        config: { format: 'swiss', deckCount: 1, minDeckSize: 40, sideboardRule: 'entire_pool', deckLockingMode: 'free_modification' },
        rounds: [],
        season: {
          id: 's1',
          league: {
            id: 'l1',
            slug: 'league',
            memberships: [],
          },
        },
      });
    prismaMock.event.update.mockResolvedValue({ id: 'e1', status: 'setup' });
    pairingMocks.generateSwissPairings.mockResolvedValue([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });

    const result = await resetEvent('e1');

    expect(roundServiceMocks.resetRoundProgress).toHaveBeenCalledTimes(1);
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: {
        status: 'setup',
        totalRounds: null,
      },
    });
    expect(pairingMocks.generateSwissPairings).toHaveBeenCalledWith('r1');
    expect(result.status).toBe('setup');
  });

  it('resets bracket events via bracket service', async () => {
    prismaMock.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'active',
        config: { format: 'double_elimination' },
        rounds: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'setup',
        config: { format: 'double_elimination', deckCount: 1, minDeckSize: 40, sideboardRule: 'entire_pool', deckLockingMode: 'free_modification' },
        rounds: [],
        season: {
          id: 's1',
          league: {
            id: 'l1',
            slug: 'league',
            memberships: [],
          },
        },
      });
    bracketServiceMocks.resetBracketEvent.mockResolvedValue(undefined);

    await resetEvent('e1');

    expect(bracketServiceMocks.resetBracketEvent).toHaveBeenCalledWith('e1');
    expect(roundServiceMocks.resetRoundProgress).not.toHaveBeenCalled();
  });

  it('blocks grand finals reset for non-double/custom formats', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'setup',
      name: 'Week 1',
      pointMultiplier: 1,
      standingsOverride: false,
      config: {
        format: 'swiss',
        bestOfN: 3,
        deckCount: 2,
        minDeckSize: 40,
        sideboardRule: 'entire_pool',
        schedulingType: 'open_window',
        deckLockingMode: 'free_modification',
        seedingSource: null,
        grandFinalsReset: false,
      },
    });

    await expect(
      updateEvent('e1', {
        config: { grandFinalsReset: true },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('re-pairs not_started rounds with stale matches during reset', async () => {
    prismaMock.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'completed',
        config: { format: 'seeded_swiss' },
        rounds: [{ id: 'r1', status: 'not_started', matches: [{ id: 'm1' }] }],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'setup',
        config: { format: 'seeded_swiss', deckCount: 1, minDeckSize: 40, sideboardRule: 'entire_pool', deckLockingMode: 'free_modification' },
        rounds: [],
        season: {
          id: 's1',
          league: {
            id: 'l1',
            slug: 'league',
            memberships: [],
          },
        },
      });
    prismaMock.event.update.mockResolvedValue({ id: 'e1', status: 'setup' });
    pairingMocks.generateSeededSwissPairings.mockResolvedValue([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    prismaMock.match.create.mockResolvedValue({ id: 'm1' });

    await resetEvent('e1');

    expect(roundServiceMocks.resetRoundProgress).toHaveBeenCalledTimes(1);
    expect(pairingMocks.generateSeededSwissPairings).toHaveBeenCalledWith('r1');
  });

  it('resets round robin events by assigning round robin pairings', async () => {
    prismaMock.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'active',
        config: { format: 'round_robin' },
        rounds: [{ id: 'r1', status: 'completed', matches: [{ id: 'm1' }] }],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        status: 'setup',
        config: { format: 'round_robin', deckCount: 1, minDeckSize: 40, sideboardRule: 'entire_pool', deckLockingMode: 'free_modification' },
        rounds: [],
        season: {
          id: 's1',
          league: {
            id: 'l1',
            slug: 'league',
            memberships: [],
          },
        },
      });
    prismaMock.event.update.mockResolvedValue({ id: 'e1', status: 'setup' });
    pairingMocks.assignRoundRobinPairings.mockResolvedValue([]);

    await resetEvent('e1');

    expect(pairingMocks.assignRoundRobinPairings).toHaveBeenCalledWith('r1');
    expect(pairingMocks.generateSwissPairings).not.toHaveBeenCalled();
  });

  it('blocks resetting setup events', async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'setup',
      config: { format: 'swiss' },
      rounds: [],
    });

    await expect(resetEvent('e1')).rejects.toMatchObject({
      code: 'INVALID_EVENT_STATE',
      message: 'Only active or completed events can be reset',
    });
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });
});
