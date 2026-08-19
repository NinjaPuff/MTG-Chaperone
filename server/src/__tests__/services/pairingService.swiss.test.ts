import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { generateSeededSwissPairings, generateSwissPairings } from '../../services/pairingService.js';

type Pair = { player1Id: string; player2Id: string | null; isBye: boolean };

function standingRow(userId: string, points = 0, omwPercent = 0.33, gwPercent = 0.33) {
  return { userId, points, omwPercent, gwPercent };
}

function mockSwissRound(roundNumber = 1) {
  return {
    id: 'r1',
    eventId: 'e1',
    roundNumber,
    event: {
      id: 'e1',
      seasonId: 's1',
      season: {
        id: 's1',
        number: 2,
        leagueId: 'l1',
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
      league: {
        memberships: memberIds.map((userId) => ({ userId })),
      },
    },
  };
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

    it('should_query_standings_by_season_points_omw_then_gw', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('u1')]);

      await generateSwissPairings('r1');

      expect(prismaMock.standing.findMany).toHaveBeenCalledWith({
        where: { seasonId: 's1' },
        orderBy: [{ points: 'desc' }, { omwPercent: 'desc' }, { gwPercent: 'desc' }],
      });
    });

    it('should_pair_adjacent_standings_order_when_even_field', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([
        standingRow('u1', 9),
        standingRow('u2', 6),
        standingRow('u3', 3),
        standingRow('u4', 0),
      ]);

      await expect(generateSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u2', isBye: false },
        { player1Id: 'u3', player2Id: 'u4', isBye: false },
      ]);
    });

    it('should_give_bye_to_last_standing_when_odd_field', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('u1', 6), standingRow('u2', 3), standingRow('u3', 0)]);

      await expect(generateSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u2', isBye: false },
        { player1Id: 'u3', player2Id: null, isBye: true },
      ]);
    });

    it('should_fall_back_to_league_membership_order_when_standings_empty', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([]);
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u3', 'u1', 'u2']));

      await expect(generateSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u3', player2Id: 'u1', isBye: false },
        { player1Id: 'u2', player2Id: null, isBye: true },
      ]);
    });

    it('should_throw_NOT_FOUND_when_standings_empty_and_event_missing', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([]);
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(generateSwissPairings('r1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should_omit_members_absent_from_standings_when_any_standings_exist', async () => {
      // Current behavior characterization: standings rows are used directly.
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('u1', 9), standingRow('u2', 6)]);
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3']));

      await expect(generateSwissPairings('r1')).resolves.toEqual([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    });

    it('should_include_standing_users_who_are_not_league_members', async () => {
      // Current behavior characterization: standings rows are used directly.
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('u1', 9), standingRow('u9', 6)]);
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2']));

      await expect(generateSwissPairings('r1')).resolves.toEqual([{ player1Id: 'u1', player2Id: 'u9', isBye: false }]);
    });

    it('should_return_empty_pairs_when_no_standings_and_no_members', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([]);
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers([]));

      await expect(generateSwissPairings('r1')).resolves.toEqual([]);
    });

    it('should_read_this_event_confirmed_matches_when_generating_swiss_pairs', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('u1', 9), standingRow('u2', 6)]);

      await generateSwissPairings('r1');

      expect(prismaMock.match.findMany).toHaveBeenCalledWith({
        where: {
          round: { eventId: 'e1' },
          status: { in: ['confirmed', 'resolved'] },
        },
        select: {
          isBye: true,
          player1Id: true,
          player2Id: true,
        },
      });
    });

    it('should_repeat_the_same_pairs_when_standings_unchanged', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([
        standingRow('u1', 9),
        standingRow('u2', 6),
        standingRow('u3', 3),
        standingRow('u4', 0),
      ]);

      const first = await generateSwissPairings('r1');
      const second = await generateSwissPairings('r1');

      expect(first).toEqual([
        { player1Id: 'u1', player2Id: 'u2', isBye: false },
        { player1Id: 'u3', player2Id: 'u4', isBye: false },
      ]);
      expect(second).toEqual(first);
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

    it('should_use_generateSwissPairings_path_when_round_number_is_greater_than_one', async () => {
      prismaMock.round.findUnique
        .mockResolvedValueOnce({ roundNumber: 2, eventId: 'e1' })
        .mockResolvedValueOnce(mockSwissRound(2));
      prismaMock.standing.findMany.mockResolvedValue([
        standingRow('u1', 9),
        standingRow('u2', 6),
        standingRow('u3', 3),
        standingRow('u4', 0),
      ]);

      await expect(generateSeededSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'u1', player2Id: 'u2', isBye: false },
        { player1Id: 'u3', player2Id: 'u4', isBye: false },
      ]);
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
      // FEATURES.md §8: avoid repeat pairings when possible.
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('A', 6), standingRow('B', 6), standingRow('C', 3), standingRow('D', 3)]);
      prismaMock.match.findMany.mockResolvedValue([
        {
          isBye: false,
          player1Id: 'A',
          player2Id: 'B',
          gameResults: [{ winnerId: 'A', isDraw: false }, { winnerId: 'A', isDraw: false }],
        },
      ]);

      const pairs = await generateSwissPairings('r1');

      expect(pairs).toEqual([
        { player1Id: 'A', player2Id: 'C', isBye: false },
        { player1Id: 'B', player2Id: 'D', isBye: false },
      ]);
    });

    it('should_give_bye_to_lowest_ranked_player_without_a_prior_bye', async () => {
      // FEATURES.md §8: lowest-ranked player without a prior bye receives the bye.
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([
        standingRow('A', 12),
        standingRow('B', 9),
        standingRow('C', 6),
        standingRow('D', 3),
        standingRow('E', 0),
      ]);
      prismaMock.match.findMany.mockResolvedValue([
        {
          isBye: true,
          player1Id: 'E',
          player2Id: null,
          gameResults: [],
        },
      ]);

      const pairs = await generateSwissPairings('r1');

      expect(pairs).toEqual([
        { player1Id: 'A', player2Id: 'B', isBye: false },
        { player1Id: 'C', player2Id: 'E', isBye: false },
        { player1Id: 'D', player2Id: null, isBye: true },
      ]);
    });

    it('should_ignore_rematches_from_other_events', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('A', 6), standingRow('B', 6), standingRow('C', 3), standingRow('D', 3)]);
      prismaMock.match.findMany.mockImplementation(async (args: any) => {
        if (args.where?.round?.eventId !== 'e1') {
          return [
            {
              isBye: false,
              player1Id: 'A',
              player2Id: 'B',
              gameResults: [{ winnerId: 'A', isDraw: false }],
            },
          ];
        }
        return [];
      });

      const pairs = await generateSwissPairings('r1');

      expect(pairs).toEqual([
        { player1Id: 'A', player2Id: 'B', isBye: false },
        { player1Id: 'C', player2Id: 'D', isBye: false },
      ]);
    });

    it('should_ignore_prior_byes_from_other_events', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([
        standingRow('A', 12),
        standingRow('B', 9),
        standingRow('C', 6),
        standingRow('D', 3),
        standingRow('E', 0),
      ]);
      prismaMock.match.findMany.mockImplementation(async (args: any) => {
        if (args.where?.round?.eventId !== 'e1') {
          return [
            {
              isBye: true,
              player1Id: 'E',
              player2Id: null,
              gameResults: [],
            },
          ];
        }
        return [];
      });

      const pairs = await generateSwissPairings('r1');

      expect(pairs).toEqual([
        { player1Id: 'A', player2Id: 'B', isBye: false },
        { player1Id: 'C', player2Id: 'D', isBye: false },
        { player1Id: 'E', player2Id: null, isBye: true },
      ]);
    });

    it('should_exclude_dropped_players_from_future_swiss_rounds', async () => {
      // FEATURES.md §9: dropped players should be excluded from future pairings.
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('A', 9), standingRow('B', 6), standingRow('C', 3), standingRow('D', 0)]);
      prismaMock.playerDrop.findMany.mockResolvedValue([{ userId: 'C', seasonId: 's1', eventId: 'e1' }]);

      const pairs = await generateSwissPairings('r1');

      expect(pairs).toEqual([
        { player1Id: 'A', player2Id: 'B', isBye: false },
        { player1Id: 'D', player2Id: null, isBye: true },
      ]);
    });

    it('should_exclude_player_with_season_wide_drop', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('A', 9), standingRow('B', 6), standingRow('C', 3), standingRow('D', 0)]);
      prismaMock.playerDrop.findMany.mockResolvedValue([{ userId: 'C', seasonId: 's1', eventId: null }]);

      await expect(generateSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'A', player2Id: 'B', isBye: false },
        { player1Id: 'D', player2Id: null, isBye: true },
      ]);
    });

    it('should_keep_player_dropped_from_a_different_event', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('A', 9), standingRow('B', 6), standingRow('C', 3), standingRow('D', 0)]);
      prismaMock.playerDrop.findMany.mockResolvedValue([]);

      await expect(generateSwissPairings('r1')).resolves.toEqual([
        { player1Id: 'A', player2Id: 'B', isBye: false },
        { player1Id: 'C', player2Id: 'D', isBye: false },
      ]);
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
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([]);
      prismaMock.event.findUnique.mockResolvedValue(mockEventWithMembers(['u1', 'u2', 'u3']));
      prismaMock.playerDrop.findMany.mockResolvedValue([{ userId: 'u3', seasonId: 's1', eventId: 'e1' }]);

      await expect(generateSwissPairings('r1')).resolves.toEqual([{ player1Id: 'u1', player2Id: 'u2', isBye: false }]);
    });

    it('should_return_empty_pairs_when_all_players_are_dropped', async () => {
      prismaMock.round.findUnique.mockResolvedValue(mockSwissRound());
      prismaMock.standing.findMany.mockResolvedValue([standingRow('A', 9), standingRow('B', 6)]);
      prismaMock.playerDrop.findMany.mockResolvedValue([
        { userId: 'A', seasonId: 's1', eventId: null },
        { userId: 'B', seasonId: 's1', eventId: null },
      ]);

      await expect(generateSwissPairings('r1')).resolves.toEqual([]);
    });
  });
});
