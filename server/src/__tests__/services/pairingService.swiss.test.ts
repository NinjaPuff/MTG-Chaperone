import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { generateSeededSwissPairings, generateSwissPairings } from '../../services/pairingService.js';

type Pair = { player1Id: string; player2Id: string | null; isBye: boolean };

const zeroRng = () => 0;

function canonical(pairs: Pair[]) {
  return {
    games: pairs
      .filter((p) => !p.isBye)
      .map((p) => [p.player1Id, p.player2Id!].sort().join(':'))
      .sort(),
    byes: pairs.filter((p) => p.isBye).map((p) => p.player1Id).sort(),
  };
}

function mockSwissRound({
  roundNumber = 2,
  totalRounds = 4,
  memberIds = ['u1', 'u2'],
}: {
  roundNumber?: number;
  totalRounds?: number | null;
  memberIds?: string[];
} = {}) {
  return {
    id: 'r1',
    eventId: 'e1',
    roundNumber,
    event: {
      id: 'e1',
      seasonId: 's1',
      totalRounds,
      pointMultiplier: 1,
      season: {
        id: 's1',
        number: 2,
        leagueId: 'l1',
        pointConfig: { matchWinPoints: 3, matchDrawPoints: 1, matchLossPoints: 0 },
        league: {
          memberships: memberIds.map((userId) => ({ userId })),
        },
      },
    },
  };
}

function mockEventWithMembers(memberIds: string[], seedingSource: string | null = null) {
  return {
    id: 'e1',
    seasonId: 's1',
    config: { seedingSource },
    season: {
      id: 's1',
      number: 2,
      leagueId: 'l1',
      pointConfig: { matchWinPoints: 3, matchDrawPoints: 1, matchLossPoints: 0 },
      league: {
        memberships: memberIds.map((userId) => ({ userId })),
      },
    },
  };
}

function winMatch(p1: string, p2: string, extras: Record<string, unknown> = {}) {
  return {
    isBye: false,
    player1Id: p1,
    player2Id: p2,
    status: 'confirmed',
    roundId: 'r0',
    gameResults: [
      { winnerId: p1, isDraw: false },
      { winnerId: p1, isDraw: false },
    ],
    round: { eventId: 'e1', id: 'r0', event: { pointMultiplier: 1 } },
    ...extras,
  };
}

function byeMatch(playerId: string, extras: Record<string, unknown> = {}) {
  return {
    isBye: true,
    player1Id: playerId,
    player2Id: null,
    status: 'confirmed',
    roundId: 'r0',
    gameResults: [],
    round: { eventId: 'e1', id: 'r0', event: { pointMultiplier: 1 } },
    ...extras,
  };
}

function stubSwissField(options: {
  roundNumber?: number;
  totalRounds?: number | null;
  memberIds: string[];
}) {
  prismaMock.round.findUnique.mockResolvedValue(mockSwissRound(options));
  prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(options.memberIds));
}

describe('pairingService swiss behavior', () => {
  beforeEach(() => {
    resetPrismaMock();
    prismaMock.match.findMany.mockResolvedValue([]);
    prismaMock.playerDrop.findMany.mockResolvedValue([]);
  });

  describe('generateSwissPairings', () => {
    it('should_throw_NOT_FOUND_when_round_missing', async () => {
      prismaMock.round.findUnique.mockResolvedValue(null);

      await expect(generateSwissPairings('r1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should_not_query_standings_for_swiss_brackets', async () => {
      stubSwissField({ roundNumber: 1, totalRounds: 3, memberIds: ['u1', 'u2'] });

      await generateSwissPairings('r1', { random: zeroRng });

      expect(prismaMock.standing.findMany).not.toHaveBeenCalled();
    });

    it('should_load_this_event_other_round_matches_for_records_and_history', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['u1', 'u2'] });

      await generateSwissPairings('r1', { random: zeroRng });

      expect(prismaMock.match.findMany).toHaveBeenCalled();
      const query = prismaMock.match.findMany.mock.calls[0]?.[0] as {
        where?: { round?: { eventId?: string; id?: unknown }; roundId?: unknown };
        select?: unknown;
        include?: unknown;
      };
      expect(query.where?.round?.eventId).toBe('e1');
      const excludesCurrent =
        JSON.stringify(query.where).includes('r1') || JSON.stringify(query.where).includes('not');
      expect(excludesCurrent).toBe(true);
      const payload = JSON.stringify(query.select ?? query.include ?? {});
      expect(payload).toContain('gameResults');
      expect(payload).toContain('isBye');
    });

    it('should_pair_round_one_randomly_not_membership_order', async () => {
      stubSwissField({ roundNumber: 1, totalRounds: 3, memberIds: ['u3', 'u1', 'u2'] });

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs)).toEqual({ games: ['u1:u2'], byes: ['u3'] });
    });

    it('should_bracket_by_event_points_not_season_standings', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D'] });
      prismaMock.standing.findMany.mockResolvedValue([
        { userId: 'A', points: 99, omwPercent: 0.9, gwPercent: 0.9 },
        { userId: 'B', points: 6, omwPercent: 0.5, gwPercent: 0.5 },
        { userId: 'C', points: 3, omwPercent: 0.4, gwPercent: 0.4 },
        { userId: 'D', points: 0, omwPercent: 0.33, gwPercent: 0.33 },
      ]);
      prismaMock.match.findMany.mockResolvedValue([winMatch('B', 'C')]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs)).toEqual({ games: ['A:C', 'B:D'], byes: [] });
      expect(canonical(pairs)).not.toEqual({ games: ['A:B', 'C:D'], byes: [] });
    });

    it('should_rank_a_bye_as_2_0_when_power_pairing_the_final_round', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 2, memberIds: ['A', 'B', 'C', 'D', 'E'] });
      prismaMock.match.findMany.mockResolvedValue([
        byeMatch('A'),
        {
          ...winMatch('B', 'C'),
          gameResults: [
            { winnerId: 'B', isDraw: false },
            { winnerId: 'C', isDraw: false },
            { winnerId: 'B', isDraw: false },
          ],
        },
        winMatch('D', 'E'),
      ]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs).byes).toEqual(['E']);
      expect(canonical(pairs).games).toEqual(['A:D', 'B:C']);
      expect(canonical(pairs).games).not.toEqual(['B:D', 'A:C']);
    });

    it('should_use_standings_pairing_when_round_is_final', async () => {
      stubSwissField({ roundNumber: 3, totalRounds: 3, memberIds: ['A', 'B', 'C', 'D'] });

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs)).toEqual({ games: ['A:B', 'C:D'], byes: [] });
    });

    it('should_block_rematch_from_pending_prior_round_pairs', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D'] });
      prismaMock.match.findMany.mockResolvedValue([
        winMatch('B', 'C', { status: 'pending', gameResults: [] }),
      ]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs).games).not.toContain('B:C');
      expect(canonical(pairs)).toEqual({ games: ['A:C', 'B:D'], byes: [] });
    });

    it('should_return_empty_pairs_when_there_are_no_members', async () => {
      stubSwissField({ roundNumber: 1, totalRounds: 3, memberIds: [] });

      await expect(generateSwissPairings('r1', { random: zeroRng })).resolves.toEqual([]);
    });
  });

  describe('generateSeededSwissPairings', () => {
    it('should_throw_NOT_FOUND_when_round_missing', async () => {
      prismaMock.round.findUnique.mockResolvedValue(null);

      await expect(generateSeededSwissPairings('r1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should_throw_NOT_FOUND_when_round_one_event_is_missing', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(generateSeededSwissPairings('r1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should_use_top_vs_bottom_on_membership_order_when_round_one_has_no_seeding_source', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], null));

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u4', isBye: false },
        { player1Id: 'u2', player2Id: 'u3', isBye: false },
      ]);
    });

    it('should_use_event_local_swiss_when_round_number_is_greater_than_one', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 3, memberIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'] });

      const pairs = await generateSeededSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs)).toEqual({ games: ['u1:u6', 'u2:u3', 'u4:u5'], byes: [] });
      expect(canonical(pairs)).not.toEqual({ games: ['u1:u6', 'u2:u5', 'u3:u4'], byes: [] });
    });
  });

  describe('round one manual seeding', () => {
    it('should_use_manual_seed_order_for_round_one_top_vs_bottom', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'manual'));
      prismaMock.eventSeed.findMany.mockResolvedValue([{ userId: 'u4' }, { userId: 'u3' }, { userId: 'u2' }, { userId: 'u1' }]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u4', player2Id: 'u1', isBye: false },
        { player1Id: 'u3', player2Id: 'u2', isBye: false },
      ]);
      expect(prismaMock.eventSeed.findMany).toHaveBeenCalledWith({
        where: { eventId: 'e1' },
        select: { userId: true },
        orderBy: { seedNum: 'asc' },
      });
    });

    it('should_throw_SEEDS_NOT_SET_when_manual_seeds_empty', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'manual'));
      prismaMock.eventSeed.findMany.mockResolvedValue([]);

      await expect(generateSeededSwissPairings('r1')).rejects.toMatchObject({
        code: 'SEEDS_NOT_SET',
      });
    });

    it('should_throw_SEEDS_INCOMPLETE_when_manual_seeds_omit_a_member', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'manual'));
      prismaMock.eventSeed.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]);

      await expect(generateSeededSwissPairings('r1')).rejects.toMatchObject({
        code: 'SEEDS_INCOMPLETE',
      });
    });

    it('should_throw_SEEDS_INCOMPLETE_when_manual_seeds_include_a_non_member', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'manual'));
      prismaMock.eventSeed.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }, { userId: 'u9' }]);

      await expect(generateSeededSwissPairings('r1')).rejects.toMatchObject({
        code: 'SEEDS_INCOMPLETE',
      });
    });
  });

  describe('round one derived seeding', () => {
    it('should_fall_back_to_memberships_when_previous_event_missing', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'previous_event'));
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u4', isBye: false },
        { player1Id: 'u2', player2Id: 'u3', isBye: false },
      ]);
    });

    it('should_order_round_one_by_previous_event_results_then_pair_top_vs_bottom', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'previous_event'));
      prismaMock.event.findFirst.mockResolvedValue({ id: 'prev' });
      prismaMock.match.findMany.mockResolvedValue([
        {
          isBye: false,
          player1Id: 'u3',
          player2Id: 'u1',
          gameResults: [{ winnerId: 'u3', isDraw: false }, { winnerId: 'u3', isDraw: false }],
        },
        {
          isBye: false,
          player1Id: 'u1',
          player2Id: 'u2',
          gameResults: [
            { winnerId: 'u1', isDraw: false },
            { winnerId: 'u1', isDraw: false },
            { winnerId: 'u2', isDraw: false },
          ],
        },
      ]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u3', player2Id: 'u4', isBye: false },
        { player1Id: 'u1', player2Id: 'u2', isBye: false },
      ]);
      expect(prismaMock.match.findMany).toHaveBeenCalledWith({
        where: {
          round: { eventId: 'prev' },
          status: { in: ['confirmed', 'resolved'] },
        },
        select: {
          isBye: true,
          player1Id: true,
          player2Id: true,
          gameResults: { select: { winnerId: true, isDraw: true } },
        },
      });
    });

    it('should_order_round_one_by_current_season_standings_when_source_is_current_season', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'current_season'));
      prismaMock.standing.findMany.mockResolvedValue([{ userId: 'u2' }, { userId: 'u1' }, { userId: 'u4' }, { userId: 'u3' }]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u2', player2Id: 'u3', isBye: false },
        { player1Id: 'u1', player2Id: 'u4', isBye: false },
      ]);
      expect(prismaMock.standing.findMany).toHaveBeenCalledWith({
        where: { seasonId: 's1' },
        orderBy: [{ points: 'desc' }, { omwPercent: 'desc' }, { gwPercent: 'desc' }, { ogwPercent: 'desc' }],
        select: { userId: true },
      });
    });

    it('should_append_unranked_members_when_current_season_standings_are_partial', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'current_season'));
      prismaMock.standing.findMany.mockResolvedValue([{ userId: 'u2' }, { userId: 'u1' }]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u2', player2Id: 'u4', isBye: false },
        { player1Id: 'u1', player2Id: 'u3', isBye: false },
      ]);
    });

    it('should_fall_back_to_memberships_when_current_season_standings_empty', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'current_season'));
      prismaMock.standing.findMany.mockResolvedValue([]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u4', isBye: false },
        { player1Id: 'u2', player2Id: 'u3', isBye: false },
      ]);
    });

    it('should_order_round_one_by_previous_season_standings_when_source_is_previous_season', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'previous_season'));
      prismaMock.season.findFirst.mockResolvedValue({ id: 's0' });
      prismaMock.standing.findMany.mockResolvedValue([{ userId: 'u4' }, { userId: 'u3' }, { userId: 'u2' }, { userId: 'u1' }]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u4', player2Id: 'u1', isBye: false },
        { player1Id: 'u3', player2Id: 'u2', isBye: false },
      ]);
      expect(prismaMock.season.findFirst).toHaveBeenCalledWith({
        where: {
          leagueId: 'l1',
          isActive: false,
          id: { not: 's1' },
        },
        select: { id: true },
        orderBy: { number: 'desc' },
      });
    });

    it('should_fall_back_to_memberships_when_previous_season_missing', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'previous_season'));
      prismaMock.season.findFirst.mockResolvedValue(null);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u4', isBye: false },
        { player1Id: 'u2', player2Id: 'u3', isBye: false },
      ]);
    });

    it('should_fall_back_to_memberships_when_seeding_source_is_unknown', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], 'not_a_source'));

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u4', isBye: false },
        { player1Id: 'u2', player2Id: 'u3', isBye: false },
      ]);
    });
  });

  describe('FEATURES.md pairing gaps', () => {
    it('should_avoid_rematch_when_a_same_record_alternate_exists', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D'] });
      prismaMock.match.findMany.mockResolvedValue([
        winMatch('B', 'C', { status: 'pending', gameResults: [] }),
      ]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs).games).not.toContain('B:C');
    });

    it('should_give_bye_to_lowest_ranked_player_without_a_prior_bye', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D', 'E'] });
      prismaMock.match.findMany.mockResolvedValue([
        winMatch('A', 'B'),
        winMatch('A', 'C', { roundId: 'r0b' }),
        winMatch('B', 'C', { roundId: 'r0c' }),
        winMatch('C', 'D', { roundId: 'r0d' }),
        byeMatch('E'),
      ]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs).byes).toEqual(['D']);
    });

    it('should_ignore_rematches_from_other_events', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D'] });
      prismaMock.match.findMany.mockImplementation(async (args: { where?: { round?: { eventId?: string } } }) => {
        if (args.where?.round?.eventId !== 'e1') {
          return [winMatch('B', 'C')];
        }
        return [];
      });

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs).games).toContain('B:C');
    });

    it('should_ignore_prior_byes_from_other_events', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D', 'E'] });
      prismaMock.match.findMany.mockImplementation(async (args: { where?: { round?: { eventId?: string } } }) => {
        if (args.where?.round?.eventId !== 'e1') {
          return [byeMatch('E')];
        }
        return [
          winMatch('A', 'B'),
          winMatch('A', 'C', { roundId: 'r0b' }),
          winMatch('B', 'C', { roundId: 'r0c' }),
          winMatch('C', 'D', { roundId: 'r0d' }),
          winMatch('D', 'E', { roundId: 'r0e' }),
        ];
      });

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs).byes).toEqual(['E']);
    });

    it('should_exclude_dropped_players_from_future_swiss_rounds', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D'] });
      prismaMock.playerDrop.findMany.mockResolvedValue([{ userId: 'C', seasonId: 's1', eventId: 'e1' }]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });
      const joined = [...canonical(pairs).games, ...canonical(pairs).byes].join(',');

      expect(joined).not.toMatch(/C/);
      expect(canonical(pairs).games.length + canonical(pairs).byes.length).toBeGreaterThan(0);
    });

    it('should_exclude_player_with_season_wide_drop', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D'] });
      prismaMock.playerDrop.findMany.mockResolvedValue([{ userId: 'C', seasonId: 's1', eventId: null }]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });
      const joined = [...canonical(pairs).games, ...canonical(pairs).byes].join(',');

      expect(joined).not.toMatch(/C/);
    });

    it('should_keep_player_dropped_from_a_different_event', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B', 'C', 'D'] });
      prismaMock.playerDrop.findMany.mockResolvedValue([]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });
      const involved = [...canonical(pairs).games, ...canonical(pairs).byes].join(',');

      expect(involved).toMatch(/C/);
    });

    it('should_omit_dropped_member_from_seeded_round_one_field', async () => {
      prismaMock.round.findUnique.mockResolvedValue({ roundNumber: 1, eventId: 'e1' });
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3', 'u4'], null));
      prismaMock.playerDrop.findMany.mockResolvedValue([{ userId: 'u4', seasonId: 's1', eventId: 'e1' }]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u3', isBye: false },
        { player1Id: 'u2', player2Id: null, isBye: true },
      ]);
    });

    it('should_omit_dropped_member_when_standings_are_empty', async () => {
      stubSwissField({ roundNumber: 1, totalRounds: 3, memberIds: ['u1', 'u2', 'u3'] });
      prismaMock.playerDrop.findMany.mockResolvedValue([{ userId: 'u3', seasonId: 's1', eventId: 'e1' }]);

      const pairs = await generateSwissPairings('r1', { random: zeroRng });

      expect(canonical(pairs)).toEqual({ games: ['u1:u2'], byes: [] });
    });

    it('should_return_empty_pairs_when_all_players_are_dropped', async () => {
      stubSwissField({ roundNumber: 2, totalRounds: 4, memberIds: ['A', 'B'] });
      prismaMock.playerDrop.findMany.mockResolvedValue([
        { userId: 'A', seasonId: 's1', eventId: null },
        { userId: 'B', seasonId: 's1', eventId: null },
      ]);

      await expect(generateSwissPairings('r1', { random: zeroRng })).resolves.toEqual([]);
    });
  });
});
