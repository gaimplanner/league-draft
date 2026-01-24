import { describe, it, expect } from 'vitest';
import { calculateDraftOrder, getCurrentPickingTeam, getNextPick } from '../draftOrder';
import type { Team } from '../../types';

// Helper to create a test team
function createTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: overrides.id || `team-${Math.random().toString(36).slice(2, 9)}`,
    divisionId: 'div-1',
    teamName: overrides.teamName || '',
    headCoach: overrides.headCoach || 'Coach',
    assistantCoach: overrides.assistantCoach || '',
    draftPosition: overrides.draftPosition ?? 1,
    roster: overrides.roster || [],
    totalScore: overrides.totalScore ?? 0,
    coachKids: overrides.coachKids || [],
    ageBreakdown: overrides.ageBreakdown || {},
    ...overrides,
  };
}

describe('calculateDraftOrder', () => {
  const initialOrder = ['team-1', 'team-2', 'team-3', 'team-4'];

  describe('straight format', () => {
    it('returns same order for all rounds', () => {
      const teams = initialOrder.map(id => createTeam({ id }));

      expect(calculateDraftOrder(teams, 1, 'straight', initialOrder)).toEqual(initialOrder);
      expect(calculateDraftOrder(teams, 2, 'straight', initialOrder)).toEqual(initialOrder);
      expect(calculateDraftOrder(teams, 3, 'straight', initialOrder)).toEqual(initialOrder);
      expect(calculateDraftOrder(teams, 10, 'straight', initialOrder)).toEqual(initialOrder);
    });
  });

  describe('snake format', () => {
    it('returns original order for odd rounds', () => {
      const teams = initialOrder.map(id => createTeam({ id }));

      expect(calculateDraftOrder(teams, 1, 'snake', initialOrder)).toEqual(initialOrder);
      expect(calculateDraftOrder(teams, 3, 'snake', initialOrder)).toEqual(initialOrder);
      expect(calculateDraftOrder(teams, 5, 'snake', initialOrder)).toEqual(initialOrder);
    });

    it('returns reversed order for even rounds', () => {
      const teams = initialOrder.map(id => createTeam({ id }));
      const reversed = ['team-4', 'team-3', 'team-2', 'team-1'];

      expect(calculateDraftOrder(teams, 2, 'snake', initialOrder)).toEqual(reversed);
      expect(calculateDraftOrder(teams, 4, 'snake', initialOrder)).toEqual(reversed);
      expect(calculateDraftOrder(teams, 6, 'snake', initialOrder)).toEqual(reversed);
    });
  });

  describe('recalculated format', () => {
    it('returns initial order for round 1', () => {
      const teams = initialOrder.map(id => createTeam({ id, totalScore: 0 }));

      expect(calculateDraftOrder(teams, 1, 'recalculated', initialOrder)).toEqual(initialOrder);
    });

    it('sorts teams by total score ascending for subsequent rounds', () => {
      const teams = [
        createTeam({ id: 'team-1', totalScore: 150 }),
        createTeam({ id: 'team-2', totalScore: 100 }),
        createTeam({ id: 'team-3', totalScore: 200 }),
        createTeam({ id: 'team-4', totalScore: 50 }),
      ];

      const result = calculateDraftOrder(teams, 2, 'recalculated', initialOrder);

      // Lowest score picks first
      expect(result).toEqual(['team-4', 'team-2', 'team-1', 'team-3']);
    });

    it('uses initial order as tiebreaker for equal scores', () => {
      const teams = [
        createTeam({ id: 'team-1', totalScore: 100 }),
        createTeam({ id: 'team-2', totalScore: 100 }),
        createTeam({ id: 'team-3', totalScore: 100 }),
        createTeam({ id: 'team-4', totalScore: 100 }),
      ];

      const result = calculateDraftOrder(teams, 2, 'recalculated', initialOrder);

      // Same scores should maintain initial order
      expect(result).toEqual(initialOrder);
    });

    it('handles mixed scores with some ties correctly', () => {
      const teams = [
        createTeam({ id: 'team-1', totalScore: 100 }),
        createTeam({ id: 'team-2', totalScore: 50 }),
        createTeam({ id: 'team-3', totalScore: 100 }),
        createTeam({ id: 'team-4', totalScore: 50 }),
      ];

      const result = calculateDraftOrder(teams, 2, 'recalculated', initialOrder);

      // team-2 and team-4 are tied at 50, team-2 comes first in initial order
      // team-1 and team-3 are tied at 100, team-1 comes first in initial order
      expect(result).toEqual(['team-2', 'team-4', 'team-1', 'team-3']);
    });
  });

  describe('edge cases', () => {
    it('handles single team', () => {
      const teams = [createTeam({ id: 'team-1' })];
      const order = ['team-1'];

      expect(calculateDraftOrder(teams, 1, 'straight', order)).toEqual(order);
      expect(calculateDraftOrder(teams, 2, 'snake', order)).toEqual(order);
      expect(calculateDraftOrder(teams, 2, 'recalculated', order)).toEqual(order);
    });

    it('handles two teams', () => {
      const teams = [
        createTeam({ id: 'team-1', totalScore: 100 }),
        createTeam({ id: 'team-2', totalScore: 50 }),
      ];
      const order = ['team-1', 'team-2'];

      expect(calculateDraftOrder(teams, 1, 'straight', order)).toEqual(order);
      expect(calculateDraftOrder(teams, 2, 'snake', order)).toEqual(['team-2', 'team-1']);
      expect(calculateDraftOrder(teams, 2, 'recalculated', order)).toEqual(['team-2', 'team-1']);
    });

    it('returns initial order for unknown format', () => {
      const teams = initialOrder.map(id => createTeam({ id }));

      // @ts-expect-error Testing unknown format
      expect(calculateDraftOrder(teams, 1, 'unknown', initialOrder)).toEqual(initialOrder);
    });
  });
});

describe('getCurrentPickingTeam', () => {
  const initialOrder = ['team-1', 'team-2', 'team-3', 'team-4'];
  const teams = initialOrder.map(id => createTeam({ id }));

  it('returns correct team for each pick in round (1-indexed)', () => {
    expect(getCurrentPickingTeam(teams, 1, 1, 'straight', initialOrder)).toBe('team-1');
    expect(getCurrentPickingTeam(teams, 1, 2, 'straight', initialOrder)).toBe('team-2');
    expect(getCurrentPickingTeam(teams, 1, 3, 'straight', initialOrder)).toBe('team-3');
    expect(getCurrentPickingTeam(teams, 1, 4, 'straight', initialOrder)).toBe('team-4');
  });

  it('respects snake order reversal', () => {
    // Round 1: normal order
    expect(getCurrentPickingTeam(teams, 1, 1, 'snake', initialOrder)).toBe('team-1');
    expect(getCurrentPickingTeam(teams, 1, 4, 'snake', initialOrder)).toBe('team-4');

    // Round 2: reversed
    expect(getCurrentPickingTeam(teams, 2, 1, 'snake', initialOrder)).toBe('team-4');
    expect(getCurrentPickingTeam(teams, 2, 4, 'snake', initialOrder)).toBe('team-1');
  });

  it('uses cached round order when provided', () => {
    const cachedOrder = ['team-4', 'team-3', 'team-2', 'team-1'];

    // Should use cached order instead of calculating
    expect(getCurrentPickingTeam(teams, 1, 1, 'straight', initialOrder, cachedOrder)).toBe('team-4');
    expect(getCurrentPickingTeam(teams, 1, 4, 'straight', initialOrder, cachedOrder)).toBe('team-1');
  });

  it('returns null for invalid pick numbers', () => {
    expect(getCurrentPickingTeam(teams, 1, 0, 'straight', initialOrder)).toBeNull();
    expect(getCurrentPickingTeam(teams, 1, 5, 'straight', initialOrder)).toBeNull();
    expect(getCurrentPickingTeam(teams, 1, -1, 'straight', initialOrder)).toBeNull();
  });
});

describe('getNextPick', () => {
  it('increments pick in round when not last pick', () => {
    expect(getNextPick(1, 1, 8)).toEqual({ round: 1, pickInRound: 2 });
    expect(getNextPick(1, 4, 8)).toEqual({ round: 1, pickInRound: 5 });
    expect(getNextPick(3, 7, 8)).toEqual({ round: 3, pickInRound: 8 });
  });

  it('advances to next round when last pick of round', () => {
    expect(getNextPick(1, 8, 8)).toEqual({ round: 2, pickInRound: 1 });
    expect(getNextPick(2, 8, 8)).toEqual({ round: 3, pickInRound: 1 });
    expect(getNextPick(5, 4, 4)).toEqual({ round: 6, pickInRound: 1 });
  });

  it('handles various team counts', () => {
    // 4 teams
    expect(getNextPick(1, 4, 4)).toEqual({ round: 2, pickInRound: 1 });

    // 6 teams
    expect(getNextPick(1, 6, 6)).toEqual({ round: 2, pickInRound: 1 });
    expect(getNextPick(1, 5, 6)).toEqual({ round: 1, pickInRound: 6 });

    // 10 teams
    expect(getNextPick(1, 10, 10)).toEqual({ round: 2, pickInRound: 1 });
    expect(getNextPick(1, 9, 10)).toEqual({ round: 1, pickInRound: 10 });
  });
});
