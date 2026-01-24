import { describe, it, expect } from 'vitest';
import { getMandatoryPick, lockSiblingToTeam, getBestAvailable } from '../draftLogic';
import type { Player } from '../../types';

// Helper to create a test player with defaults
function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id || `player-${Math.random().toString(36).slice(2, 9)}`,
    divisionId: 'div-1',
    bib: overrides.bib || '100',
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'Player',
    name: overrides.name || `${overrides.firstName || 'Test'} ${overrides.lastName || 'Player'}`,
    fieldScore: 0,
    throwScore: 0,
    hitPower: 0,
    hitForm: 0,
    hitContact: 0,
    pitchingStrength: 0,
    pitchingForm: 0,
    catchScore: 0,
    runningScore: 0,
    fieldingSubtotal: 0,
    hittingSubtotal: 0,
    pitchingSubtotal: 0,
    subjectiveTotal: 0,
    objectiveTotal: 0,
    officialAdjust: 0,
    totalScore: overrides.totalScore ?? 50,
    rank: overrides.rank ?? 1,
    projectedRound: overrides.projectedRound ?? 1,
    littleLeagueAge: overrides.littleLeagueAge ?? 10,
    birthday: '2015-01-01',
    isAllStar: false,
    isDNE: false,
    isCoachKid: overrides.isCoachKid ?? false,
    coachTeamId: overrides.coachTeamId,
    sibling: overrides.sibling,
    siblingId: overrides.siblingId,
    lockedToRound: overrides.lockedToRound,
    lockedToTeamId: overrides.lockedToTeamId,
    isDrafted: overrides.isDrafted ?? false,
    draftedByTeamId: overrides.draftedByTeamId,
    draftedInRound: overrides.draftedInRound,
    draftedAtPick: overrides.draftedAtPick,
    ...overrides,
  };
}

describe('getMandatoryPick', () => {
  describe('coach kid detection', () => {
    it('returns coach kid when projected round matches current round', () => {
      const coachKid = createPlayer({
        id: 'coach-kid-1',
        name: 'Coach Kid',
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 2,
      });
      const players = [coachKid];

      const result = getMandatoryPick(players, 'team-1', 2);

      expect(result).not.toBeNull();
      expect(result?.player.id).toBe('coach-kid-1');
      expect(result?.reason).toBe('coach-kid');
    });

    it('returns null when coach kid projected round does not match', () => {
      const coachKid = createPlayer({
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 3,
      });
      const players = [coachKid];

      const result = getMandatoryPick(players, 'team-1', 2);

      expect(result).toBeNull();
    });

    it('returns null when coach kid belongs to different team', () => {
      const coachKid = createPlayer({
        isCoachKid: true,
        coachTeamId: 'team-2',
        projectedRound: 2,
      });
      const players = [coachKid];

      const result = getMandatoryPick(players, 'team-1', 2);

      expect(result).toBeNull();
    });

    it('returns null when coach kid is already drafted', () => {
      const coachKid = createPlayer({
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 2,
        isDrafted: true,
      });
      const players = [coachKid];

      const result = getMandatoryPick(players, 'team-1', 2);

      expect(result).toBeNull();
    });

    it('uses lockedToRound over projectedRound when set', () => {
      const coachKid = createPlayer({
        id: 'coach-kid-locked',
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 2,
        lockedToRound: 3,
      });
      const players = [coachKid];

      // Should NOT match in round 2
      expect(getMandatoryPick(players, 'team-1', 2)).toBeNull();

      // Should match in round 3
      const result = getMandatoryPick(players, 'team-1', 3);
      expect(result?.player.id).toBe('coach-kid-locked');
    });
  });

  describe('sibling detection', () => {
    it('returns sibling locked to team in their projected round', () => {
      const sibling = createPlayer({
        id: 'sibling-1',
        name: 'Sibling Player',
        siblingId: 'other-sibling',
        lockedToTeamId: 'team-1',
        projectedRound: 3,
      });
      const players = [sibling];

      const result = getMandatoryPick(players, 'team-1', 3);

      expect(result).not.toBeNull();
      expect(result?.player.id).toBe('sibling-1');
      expect(result?.reason).toBe('sibling');
    });

    it('returns null when sibling locked to different team', () => {
      const sibling = createPlayer({
        siblingId: 'other-sibling',
        lockedToTeamId: 'team-2',
        projectedRound: 3,
      });
      const players = [sibling];

      const result = getMandatoryPick(players, 'team-1', 3);

      expect(result).toBeNull();
    });

    it('prioritizes coach kid over sibling when both due same round', () => {
      const coachKid = createPlayer({
        id: 'coach-kid',
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 2,
      });
      const sibling = createPlayer({
        id: 'sibling',
        siblingId: 'other',
        lockedToTeamId: 'team-1',
        projectedRound: 2,
      });
      const players = [sibling, coachKid];

      const result = getMandatoryPick(players, 'team-1', 2);

      expect(result?.reason).toBe('coach-kid');
      expect(result?.player.id).toBe('coach-kid');
    });
  });

  describe('forced early pick due to insufficient remaining picks', () => {
    it('forces mandatory pick when mandatory count >= remaining picks', () => {
      const coachKid1 = createPlayer({
        id: 'ck-1',
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 5,
      });
      const coachKid2 = createPlayer({
        id: 'ck-2',
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 6,
      });
      const players = [coachKid1, coachKid2];

      // Round 3, team has made 2 picks, 8 total rounds = 6 remaining picks
      // 2 mandatory players, 6 remaining = no force yet
      expect(getMandatoryPick(players, 'team-1', 3, {
        includeCoachKids: true,
        includeSiblings: true,
        totalRounds: 8,
        teamPicksMade: 2,
      })).toBeNull();

      // Round 5, team has made 4 picks = 4 remaining picks
      // 2 mandatory players, 4 remaining = no force yet
      expect(getMandatoryPick(players, 'team-1', 5, {
        includeCoachKids: true,
        includeSiblings: true,
        totalRounds: 8,
        teamPicksMade: 4,
      })?.player.id).toBe('ck-1'); // ck-1 is due in round 5

      // Round 7, team has made 6 picks = 2 remaining picks
      // 2 mandatory players, 2 remaining = FORCE (must pick ck-1 with earliest effective round)
      const result = getMandatoryPick(players, 'team-1', 7, {
        includeCoachKids: true,
        includeSiblings: true,
        totalRounds: 8,
        teamPicksMade: 6,
      });
      expect(result).not.toBeNull();
      expect(result?.player.id).toBe('ck-1'); // Earlier projected round
    });

    it('selects player with earliest effective round when forcing', () => {
      const coachKid = createPlayer({
        id: 'ck',
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 6,
      });
      const lockedSibling = createPlayer({
        id: 'sib',
        siblingId: 'other',
        lockedToTeamId: 'team-1',
        projectedRound: 4,
      });
      const players = [coachKid, lockedSibling];

      // 2 mandatory, 2 remaining - force needed, should pick sibling (round 4 < round 6)
      const result = getMandatoryPick(players, 'team-1', 7, {
        includeCoachKids: true,
        includeSiblings: true,
        totalRounds: 8,
        teamPicksMade: 6,
      });

      expect(result?.player.id).toBe('sib');
      expect(result?.reason).toBe('sibling');
    });
  });

  describe('option flags', () => {
    it('ignores coach kids when includeCoachKids is false', () => {
      const coachKid = createPlayer({
        isCoachKid: true,
        coachTeamId: 'team-1',
        projectedRound: 2,
      });
      const players = [coachKid];

      const result = getMandatoryPick(players, 'team-1', 2, {
        includeCoachKids: false,
        includeSiblings: true,
      });

      expect(result).toBeNull();
    });

    it('ignores siblings when includeSiblings is false', () => {
      const sibling = createPlayer({
        siblingId: 'other',
        lockedToTeamId: 'team-1',
        projectedRound: 2,
      });
      const players = [sibling];

      const result = getMandatoryPick(players, 'team-1', 2, {
        includeCoachKids: true,
        includeSiblings: false,
      });

      expect(result).toBeNull();
    });
  });
});

describe('lockSiblingToTeam', () => {
  it('locks direct sibling to team', () => {
    const drafted = createPlayer({
      id: 'drafted',
      siblingId: 'sibling-1',
    });
    const sibling = createPlayer({
      id: 'sibling-1',
      siblingId: 'drafted',
    });
    const players = [drafted, sibling];

    lockSiblingToTeam(players, drafted, 'team-1');

    expect(sibling.lockedToTeamId).toBe('team-1');
  });

  it('does not lock already drafted sibling', () => {
    const drafted = createPlayer({
      id: 'drafted',
      siblingId: 'sibling-1',
    });
    const sibling = createPlayer({
      id: 'sibling-1',
      siblingId: 'drafted',
      isDrafted: true,
      draftedByTeamId: 'team-2',
    });
    const players = [drafted, sibling];

    lockSiblingToTeam(players, drafted, 'team-1');

    expect(sibling.lockedToTeamId).toBeUndefined();
  });

  it('follows sibling chain for 3+ siblings', () => {
    // Chain: A -> B -> C (siblings linked in a chain)
    const playerA = createPlayer({
      id: 'player-a',
      name: 'Player A',
      siblingId: 'player-b',
    });
    const playerB = createPlayer({
      id: 'player-b',
      name: 'Player B',
      siblingId: 'player-c',
    });
    const playerC = createPlayer({
      id: 'player-c',
      name: 'Player C',
      siblingId: 'player-b', // Points back to B
    });
    const players = [playerA, playerB, playerC];

    lockSiblingToTeam(players, playerA, 'team-1');

    expect(playerB.lockedToTeamId).toBe('team-1');
    expect(playerC.lockedToTeamId).toBe('team-1');
  });

  it('handles reverse sibling links', () => {
    // B's siblingId points to A, but A has no siblingId pointing to B
    const playerA = createPlayer({
      id: 'player-a',
      name: 'Player A',
      // No siblingId
    });
    const playerB = createPlayer({
      id: 'player-b',
      name: 'Player B',
      siblingId: 'player-a', // Points to A
    });
    const players = [playerA, playerB];

    lockSiblingToTeam(players, playerA, 'team-1');

    expect(playerB.lockedToTeamId).toBe('team-1');
  });

  it('does not modify drafted player', () => {
    const drafted = createPlayer({
      id: 'drafted',
      siblingId: 'sibling-1',
      isDrafted: true,
    });
    const sibling = createPlayer({
      id: 'sibling-1',
    });
    const players = [drafted, sibling];

    lockSiblingToTeam(players, drafted, 'team-1');

    expect(drafted.lockedToTeamId).toBeUndefined();
  });
});

describe('getBestAvailable', () => {
  it('returns player with highest score', () => {
    const players = [
      createPlayer({ id: 'p1', totalScore: 60 }),
      createPlayer({ id: 'p2', totalScore: 80 }),
      createPlayer({ id: 'p3', totalScore: 70 }),
    ];

    const result = getBestAvailable(players);

    expect(result?.id).toBe('p2');
  });

  it('excludes drafted players', () => {
    const players = [
      createPlayer({ id: 'p1', totalScore: 80, isDrafted: true }),
      createPlayer({ id: 'p2', totalScore: 60, isDrafted: false }),
    ];

    const result = getBestAvailable(players);

    expect(result?.id).toBe('p2');
  });

  it('excludes coach kids from other teams when includeCoachKids is true', () => {
    const players = [
      createPlayer({ id: 'ck', totalScore: 90, isCoachKid: true, coachTeamId: 'team-2' }),
      createPlayer({ id: 'regular', totalScore: 70 }),
    ];

    const result = getBestAvailable(players, 'team-1', { includeCoachKids: true, includeSiblings: true });

    expect(result?.id).toBe('regular');
  });

  it('includes coach kids from other teams when includeCoachKids is false', () => {
    const players = [
      createPlayer({ id: 'ck', totalScore: 90, isCoachKid: true, coachTeamId: 'team-2' }),
      createPlayer({ id: 'regular', totalScore: 70 }),
    ];

    const result = getBestAvailable(players, 'team-1', { includeCoachKids: false, includeSiblings: true });

    expect(result?.id).toBe('ck');
  });

  it('allows coach kids for their own team', () => {
    const players = [
      createPlayer({ id: 'ck', totalScore: 90, isCoachKid: true, coachTeamId: 'team-1' }),
      createPlayer({ id: 'regular', totalScore: 70 }),
    ];

    const result = getBestAvailable(players, 'team-1', { includeCoachKids: true, includeSiblings: true });

    expect(result?.id).toBe('ck');
  });

  it('excludes siblings locked to other teams', () => {
    const players = [
      createPlayer({ id: 'locked', totalScore: 90, lockedToTeamId: 'team-2' }),
      createPlayer({ id: 'regular', totalScore: 70 }),
    ];

    const result = getBestAvailable(players, 'team-1', { includeCoachKids: true, includeSiblings: true });

    expect(result?.id).toBe('regular');
  });

  it('allows siblings locked to current team', () => {
    const players = [
      createPlayer({ id: 'locked', totalScore: 90, lockedToTeamId: 'team-1' }),
      createPlayer({ id: 'regular', totalScore: 70 }),
    ];

    const result = getBestAvailable(players, 'team-1', { includeCoachKids: true, includeSiblings: true });

    expect(result?.id).toBe('locked');
  });

  it('returns null when no players available', () => {
    const players = [
      createPlayer({ id: 'p1', isDrafted: true }),
      createPlayer({ id: 'p2', isDrafted: true }),
    ];

    const result = getBestAvailable(players);

    expect(result).toBeNull();
  });

  it('returns null for empty player list', () => {
    const result = getBestAvailable([]);

    expect(result).toBeNull();
  });
});
