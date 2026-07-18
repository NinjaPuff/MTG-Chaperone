import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

const bracketServiceMocks = vi.hoisted(() => ({
  advanceBracket: vi.fn(),
  syncBracketPairings: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));
vi.mock('../../services/bracketService.js', () => bracketServiceMocks);

import { confirmMatch, reportMatch, resolveMatch, updateMatchPlayers, updateRoundPairings, validateGameResults } from '../../services/matchService.js';

describe('matchService', () => {
  beforeEach(() => {
    resetPrismaMock();
    bracketServiceMocks.advanceBracket.mockReset();
    bracketServiceMocks.syncBracketPairings.mockReset();
  });

  it('requires at least one game result when reporting', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });

    await expect(reportMatch('m1', 'u1', [])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'At least one game result is required',
    });
    expect(prismaMock.match.update).not.toHaveBeenCalled();
    expect(prismaMock.gameResult.create).not.toHaveBeenCalled();
  });

  it('confirms a reported match for the non-reporter participant', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'reported',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: 'u1',
      round: { status: 'in_progress', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'in_progress',
      matches: [{ status: 'confirmed' }, { status: 'resolved' }],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'confirmed', gameResults: [] });

    const result = await confirmMatch('m1', 'u2');

    expect(result.status).toBe('confirmed');
    expect(prismaMock.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        status: 'confirmed',
        confirmedAt: expect.any(Date),
      },
      include: { gameResults: true },
    });
    expect(prismaMock.round.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'completed' },
    });
    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: {
        roundId: 'r1',
        userId: { in: ['u1', 'u2'] },
        status: 'submitted',
      },
      data: { status: 'locked' },
    });
  });

  it('blocks reporting when round has not started', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'not_started', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });

    await expect(reportMatch('m1', 'u1', [{ winnerId: 'u1', isDraw: false }])).rejects.toMatchObject({
      code: 'INVALID_ROUND_STATE',
      message: 'Round must be in progress to report matches',
    });
    expect(prismaMock.match.update).not.toHaveBeenCalled();
  });

  it('locks submitted decks after reporting a swiss match', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'reported', gameResults: [] });

    await reportMatch('m1', 'u1', [{ winnerId: 'u1', isDraw: false }]);

    expect(prismaMock.decklist.updateMany).toHaveBeenCalledWith({
      where: {
        roundId: 'r1',
        userId: { in: ['u1', 'u2'] },
        status: 'submitted',
      },
      data: { status: 'locked' },
    });
  });

  it('does not lock decklists for round robin matches', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'round_robin' } } },
      gameResults: [],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'reported', gameResults: [] });

    await reportMatch('m1', 'u1', [{ winnerId: 'u1', isDraw: false }]);

    expect(prismaMock.decklist.updateMany).not.toHaveBeenCalled();
  });

  it('syncs bracket pairings after a bracket match is reported', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u3',
      player2Id: 'u6',
      roundId: 'r1',
      reportedById: null,
      round: {
        status: 'in_progress',
        eventId: 'event-1',
        event: { season: {}, config: { format: 'custom_10_player' } },
      },
      gameResults: [],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'reported', gameResults: [] });
    bracketServiceMocks.syncBracketPairings.mockResolvedValue(undefined);

    await reportMatch('m1', 'u3', [
      { winnerId: 'u3', isDraw: false },
      { winnerId: 'u3', isDraw: false },
    ]);

    expect(bracketServiceMocks.syncBracketPairings).toHaveBeenCalledWith('event-1');
    expect(bracketServiceMocks.advanceBracket).not.toHaveBeenCalled();
  });

  it('rejects bracket reports with tied wins', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'single_elimination' } } },
      gameResults: [],
    });

    await expect(
      reportMatch('m1', 'u1', [
        { winnerId: 'u1', isDraw: false },
        { winnerId: 'u2', isDraw: false },
      ]),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Bracket matches must produce a winner',
    });
  });

  it('rejects isDraw on round-robin report', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'round_robin' } } },
      gameResults: [],
    });

    await expect(
      reportMatch('m1', 'u1', [{ winnerId: null, isDraw: true }]),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Game draws are not supported',
    });
    expect(prismaMock.match.update).not.toHaveBeenCalled();
  });

  it('accepts tied wins on round-robin report', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'round_robin' } } },
      gameResults: [],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'reported', gameResults: [] });

    await reportMatch('m1', 'u1', [
      { winnerId: 'u1', isDraw: false },
      { winnerId: 'u2', isDraw: false },
    ]);

    expect(prismaMock.match.update).toHaveBeenCalled();
  });

  it('rejects tied wins on bracket resolve', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'admin' });
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'disputed',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: 'u1',
      round: { status: 'in_progress', event: { season: {}, config: { format: 'single_elimination' } } },
      gameResults: [],
    });

    await expect(
      resolveMatch('m1', 'admin-1', [
        { winnerId: 'u1', isDraw: false },
        { winnerId: 'u2', isDraw: false },
      ]),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Bracket matches must produce a winner',
    });
    expect(prismaMock.match.update).not.toHaveBeenCalled();
  });

  it('accepts valid 2-1 on round-robin report', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: null,
      round: { status: 'in_progress', event: { season: {}, config: { format: 'round_robin' } } },
      gameResults: [],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'reported', gameResults: [] });

    await reportMatch('m1', 'u1', [
      { winnerId: 'u1', isDraw: false },
      { winnerId: 'u2', isDraw: false },
      { winnerId: 'u1', isDraw: false },
    ]);

    expect(prismaMock.match.update).toHaveBeenCalled();
  });

  it('rejects isDraw on resolve', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'admin' });
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'disputed',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: 'u1',
      round: { status: 'in_progress', event: { season: {}, config: { format: 'swiss' } } },
      gameResults: [],
    });

    await expect(
      resolveMatch('m1', 'admin-1', [{ winnerId: null, isDraw: true }]),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Game draws are not supported',
    });
    expect(prismaMock.match.update).not.toHaveBeenCalled();
  });

  describe('validateGameResults', () => {
    it('rejects game draws', () => {
      expect(() =>
        validateGameResults('u1', 'u2', [{ winnerId: null, isDraw: true }]),
      ).toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Game draws are not supported',
        }),
      );
    });

    it('accepts tied wins', () => {
      expect(() =>
        validateGameResults('u1', 'u2', [
          { winnerId: 'u1', isDraw: false },
          { winnerId: 'u2', isDraw: false },
        ]),
      ).not.toThrow();
    });

    it('accepts valid results', () => {
      expect(() =>
        validateGameResults('u1', 'u2', [
          { winnerId: 'u1', isDraw: false },
          { winnerId: 'u2', isDraw: false },
          { winnerId: 'u1', isDraw: false },
        ]),
      ).not.toThrow();
    });
  });

  it('advances brackets on confirm', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'reported',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: 'u1',
      round: { status: 'in_progress', event: { season: {}, config: { format: 'double_elimination' } } },
      gameResults: [],
    });
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'in_progress',
      matches: [{ status: 'confirmed' }, { status: 'resolved' }],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'confirmed', gameResults: [] });
    bracketServiceMocks.advanceBracket.mockResolvedValue(undefined);

    await confirmMatch('m1', 'u2');

    expect(bracketServiceMocks.advanceBracket).toHaveBeenCalledWith('m1');
  });

  it('advances brackets on resolve', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'admin' });
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'disputed',
      player1Id: 'u1',
      player2Id: 'u2',
      roundId: 'r1',
      reportedById: 'u1',
      round: { status: 'in_progress', event: { season: {}, config: { format: 'custom_10_player' } } },
      gameResults: [],
    });
    prismaMock.round.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'in_progress',
      matches: [{ status: 'confirmed' }, { status: 'resolved' }],
    });
    prismaMock.match.update.mockResolvedValue({ id: 'm1', status: 'resolved', gameResults: [] });
    bracketServiceMocks.advanceBracket.mockResolvedValue(undefined);

    await resolveMatch('m1', 'admin-1', [{ winnerId: 'u1', isDraw: false }]);

    expect(bracketServiceMocks.advanceBracket).toHaveBeenCalledWith('m1');
  });

  describe('updateMatchPlayers', () => {
    const baseMatch = {
      id: 'm1',
      status: 'pending',
      player1Id: 'u1',
      player2Id: 'u2',
      isBye: false,
      roundId: 'r1',
      round: {
        id: 'r1',
        status: 'not_started',
        event: {
          season: { leagueId: 'league-1' },
          config: { format: 'swiss' },
        },
      },
      gameResults: [],
    };

    beforeEach(() => {
      prismaMock.leagueMembership.findMany.mockResolvedValue([
        { userId: 'u1' },
        { userId: 'u2' },
        { userId: 'u3' },
      ]);
      prismaMock.match.findMany.mockResolvedValue([]);
      prismaMock.scheduledPairing.updateMany.mockResolvedValue({ count: 1 });
    });

    it('swaps player1 on a not_started round', async () => {
      prismaMock.match.findUnique.mockResolvedValue(baseMatch);
      prismaMock.match.update.mockResolvedValue({ ...baseMatch, player1Id: 'u3' });

      await updateMatchPlayers('m1', { player1Id: 'u3' });

      expect(prismaMock.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: {
          player1: { connect: { id: 'u3' } },
        },
        include: {
          player1: true,
          player2: true,
          gameResults: true,
        },
      });
    });

    it('swaps player2', async () => {
      prismaMock.match.findUnique.mockResolvedValue(baseMatch);
      prismaMock.match.update.mockResolvedValue({ ...baseMatch, player2Id: 'u3' });

      await updateMatchPlayers('m1', { player2Id: 'u3' });

      expect(prismaMock.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: {
          player2: { connect: { id: 'u3' } },
        },
        include: {
          player1: true,
          player2: true,
          gameResults: true,
        },
      });
    });

    it('converts match to bye when player2 is null', async () => {
      prismaMock.match.findUnique.mockResolvedValue(baseMatch);
      prismaMock.match.update.mockResolvedValue({ ...baseMatch, player2Id: null, isBye: true, status: 'confirmed' });

      await updateMatchPlayers('m1', { player2Id: null });

      expect(prismaMock.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: {
          player2: { disconnect: true },
          isBye: true,
          status: 'confirmed',
          confirmedAt: expect.any(Date),
        },
        include: {
          player1: true,
          player2: true,
          gameResults: true,
        },
      });
      expect(prismaMock.scheduledPairing.updateMany).not.toHaveBeenCalled();
    });

    it('converts bye to match when player2 is set', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...baseMatch,
        player2Id: null,
        isBye: true,
        status: 'confirmed',
      });
      prismaMock.match.update.mockResolvedValue({ ...baseMatch, player2Id: 'u3', isBye: false, status: 'pending' });

      await updateMatchPlayers('m1', { player2Id: 'u3' });

      expect(prismaMock.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: {
          player2: { connect: { id: 'u3' } },
          isBye: false,
          status: 'pending',
          confirmedAt: null,
        },
        include: {
          player1: true,
          player2: true,
          gameResults: true,
        },
      });
    });

    it('rejects in_progress round', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...baseMatch,
        round: {
          ...baseMatch.round,
          status: 'in_progress',
        },
      });

      await expect(updateMatchPlayers('m1', { player1Id: 'u3' })).rejects.toMatchObject({
        code: 'INVALID_ROUND_STATE',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects bracket format', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...baseMatch,
        round: {
          ...baseMatch.round,
          event: {
            season: { leagueId: 'league-1' },
            config: { format: 'single_elimination' },
          },
        },
      });

      await expect(updateMatchPlayers('m1', { player1Id: 'u3' })).rejects.toMatchObject({
        code: 'INVALID_OPERATION',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects non-league-member', async () => {
      prismaMock.match.findUnique.mockResolvedValue(baseMatch);

      await expect(updateMatchPlayers('m1', { player1Id: 'u99' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'All players must be league members',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects same player1 and player2', async () => {
      prismaMock.match.findUnique.mockResolvedValue(baseMatch);

      await expect(updateMatchPlayers('m1', { player2Id: 'u1' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Player 1 and player 2 must be different',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects duplicate player in round', async () => {
      prismaMock.match.findUnique.mockResolvedValue(baseMatch);
      prismaMock.match.findMany.mockResolvedValue([
        { player1Id: 'u3', player2Id: 'u4' },
      ]);

      await expect(updateMatchPlayers('m1', { player1Id: 'u3' })).rejects.toMatchObject({
        code: 'DUPLICATE_PLAYER',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('updates scheduledPairing for round robin', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...baseMatch,
        round: {
          ...baseMatch.round,
          event: {
            season: { leagueId: 'league-1' },
            config: { format: 'round_robin' },
          },
        },
      });
      prismaMock.match.update.mockResolvedValue({ ...baseMatch, player1Id: 'u3' });

      await updateMatchPlayers('m1', { player1Id: 'u3' });

      expect(prismaMock.scheduledPairing.updateMany).toHaveBeenCalledWith({
        where: {
          roundId: 'r1',
          OR: [
            { player1Id: 'u1', player2Id: 'u2' },
            { player1Id: 'u2', player2Id: 'u1' },
          ],
        },
        data: {
          player1Id: 'u3',
          player2Id: 'u2',
        },
      });
    });
  });

  describe('updateRoundPairings', () => {
    const baseRound = {
      id: 'r1',
      status: 'not_started',
      matches: [
        { id: 'm1', player1Id: 'u1', player2Id: 'u2', isBye: false },
        { id: 'm2', player1Id: 'u3', player2Id: 'u4', isBye: false },
      ],
      event: {
        season: { leagueId: 'league-1' },
        config: { format: 'swiss' },
      },
    };

    beforeEach(() => {
      prismaMock.leagueMembership.findMany.mockResolvedValue([
        { userId: 'u1' },
        { userId: 'u2' },
        { userId: 'u3' },
        { userId: 'u4' },
        { userId: 'u5' },
      ]);
      prismaMock.scheduledPairing.updateMany.mockResolvedValue({ count: 1 });
    });

    it('updates all changed matches in a not_started round', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u5', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ]);

      expect(prismaMock.match.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: {
          player1: { connect: { id: 'u5' } },
        },
      });
    });

    it('skips unchanged matches', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u1', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ]);

      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects in_progress round', async () => {
      prismaMock.round.findUnique.mockResolvedValue({
        ...baseRound,
        status: 'in_progress',
      });

      await expect(updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u5', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ])).rejects.toMatchObject({
        code: 'INVALID_ROUND_STATE',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects bracket format', async () => {
      prismaMock.round.findUnique.mockResolvedValue({
        ...baseRound,
        event: {
          season: { leagueId: 'league-1' },
          config: { format: 'single_elimination' },
        },
      });

      await expect(updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u5', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ])).rejects.toMatchObject({
        code: 'INVALID_OPERATION',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects duplicate player across pairings', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await expect(updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u5', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u5', player2Id: 'u4' },
      ])).rejects.toMatchObject({
        code: 'DUPLICATE_PLAYER',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects same player1 and player2', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await expect(updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u5', player2Id: 'u5' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ])).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects non-league-member', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await expect(updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u99', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ])).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('rejects when matchId not in round', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await expect(updateRoundPairings('r1', [
        { matchId: 'm99', player1Id: 'u5', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ])).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Match does not belong to this round',
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects duplicate matchId in payload', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await expect(updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u1', player2Id: 'u2' },
        { matchId: 'm1', player1Id: 'u3', player2Id: 'u4' },
      ])).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Duplicate match in pairings payload',
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates a match on an empty round when matchId is omitted', async () => {
      prismaMock.round.findUnique.mockResolvedValue({
        ...baseRound,
        matches: [],
      });

      await updateRoundPairings('r1', [{ player1Id: 'u1', player2Id: 'u2' }]);

      expect(prismaMock.match.create).toHaveBeenCalledWith({
        data: {
          roundId: 'r1',
          player1Id: 'u1',
          player2Id: 'u2',
          isBye: false,
          status: 'pending',
          confirmedAt: null,
        },
      });
      expect(prismaMock.match.delete).not.toHaveBeenCalled();
    });

    it('deletes matches omitted from payload', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await updateRoundPairings('r1', [{ matchId: 'm1', player1Id: 'u1', player2Id: 'u2' }]);

      expect(prismaMock.gameResult.deleteMany).toHaveBeenCalledWith({
        where: { matchId: 'm2' },
      });
      expect(prismaMock.match.delete).toHaveBeenCalledWith({
        where: { id: 'm2' },
      });
      expect(prismaMock.match.create).not.toHaveBeenCalled();
    });

    it('handles add, remove, and update in one save', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u5', player2Id: 'u2' },
        { player1Id: 'u3', player2Id: 'u4' },
      ]);

      expect(prismaMock.match.delete).toHaveBeenCalledWith({ where: { id: 'm2' } });
      expect(prismaMock.match.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          roundId: 'r1',
          player1Id: 'u3',
          player2Id: 'u4',
        }),
      });
      expect(prismaMock.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { player1: { connect: { id: 'u5' } } },
      });
    });

    it('deletes all matches when payload is empty', async () => {
      prismaMock.round.findUnique.mockResolvedValue(baseRound);

      await updateRoundPairings('r1', []);

      expect(prismaMock.match.delete).toHaveBeenCalledTimes(2);
      expect(prismaMock.match.create).not.toHaveBeenCalled();
      expect(prismaMock.match.update).not.toHaveBeenCalled();
    });

    it('creates a bye match when player2Id is null', async () => {
      prismaMock.round.findUnique.mockResolvedValue({
        ...baseRound,
        matches: [],
      });

      await updateRoundPairings('r1', [{ player1Id: 'u5', player2Id: null }]);

      expect(prismaMock.match.create).toHaveBeenCalledWith({
        data: {
          roundId: 'r1',
          player1Id: 'u5',
          player2Id: null,
          isBye: true,
          status: 'confirmed',
          confirmedAt: expect.any(Date),
        },
      });
    });

    it('releases scheduledPairings when deleting round robin matches', async () => {
      prismaMock.round.findUnique.mockResolvedValue({
        ...baseRound,
        event: {
          season: { leagueId: 'league-1' },
          config: { format: 'round_robin' },
        },
      });

      await updateRoundPairings('r1', [{ matchId: 'm1', player1Id: 'u1', player2Id: 'u2' }]);

      expect(prismaMock.scheduledPairing.updateMany).toHaveBeenCalledWith({
        where: {
          roundId: 'r1',
          OR: [
            { player1Id: 'u3', player2Id: 'u4' },
            { player1Id: 'u4', player2Id: 'u3' },
          ],
        },
        data: { roundId: null },
      });
    });

    it('allows saving when some league members are unpaired', async () => {
      prismaMock.round.findUnique.mockResolvedValue({
        ...baseRound,
        matches: [
          { id: 'm1', player1Id: 'u1', player2Id: 'u2', isBye: false },
          { id: 'm2', player1Id: 'u3', player2Id: 'u4', isBye: false },
        ],
      });

      await updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u1', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ]);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.match.update).not.toHaveBeenCalled();
      expect(prismaMock.match.delete).not.toHaveBeenCalled();
      expect(prismaMock.match.create).not.toHaveBeenCalled();
    });

    it('updates scheduledPairings for round robin', async () => {
      prismaMock.round.findUnique.mockResolvedValue({
        ...baseRound,
        event: {
          season: { leagueId: 'league-1' },
          config: { format: 'round_robin' },
        },
      });

      await updateRoundPairings('r1', [
        { matchId: 'm1', player1Id: 'u5', player2Id: 'u2' },
        { matchId: 'm2', player1Id: 'u3', player2Id: 'u4' },
      ]);

      expect(prismaMock.scheduledPairing.updateMany).toHaveBeenCalledWith({
        where: {
          roundId: 'r1',
          OR: [
            { player1Id: 'u1', player2Id: 'u2' },
            { player1Id: 'u2', player2Id: 'u1' },
          ],
        },
        data: {
          player1Id: 'u5',
          player2Id: 'u2',
        },
      });
    });
  });
});
