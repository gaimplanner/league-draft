import { describe, it, expect } from 'vitest';
import {
  PLAYER_FIELD_DEFINITIONS,
  FIELD_BY_FRONTEND,
  FIELD_BY_BACKEND,
  getRequiredFields,
  getNumericFields,
  getScoreFields,
  transformPlayerFromApi,
  transformPlayerToApi,
  toBackendFieldName,
  toFrontendFieldName,
  validatePlayer,
  validatePlayersBeforeSave,
} from '../importPipeline';

describe('Field Definitions', () => {
  it('has all expected player fields', () => {
    const fieldNames = PLAYER_FIELD_DEFINITIONS.map((def) => def.frontend);

    // Core fields
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('firstName');
    expect(fieldNames).toContain('lastName');
    expect(fieldNames).toContain('bib');

    // Score fields
    expect(fieldNames).toContain('totalScore');
    expect(fieldNames).toContain('fieldScore');

    // Draft fields
    expect(fieldNames).toContain('isDrafted');
    expect(fieldNames).toContain('isCoachKid');
    expect(fieldNames).toContain('siblingId');

    // Team Builder fields
    expect(fieldNames).toContain('school');
    expect(fieldNames).toContain('grade');
    expect(fieldNames).toContain('coachRequest');
    expect(fieldNames).toContain('teammateRequests');
  });

  it('maps frontend to backend names correctly', () => {
    const def = FIELD_BY_FRONTEND.get('firstName');
    expect(def?.backend).toBe('first_name');

    const ageDef = FIELD_BY_FRONTEND.get('littleLeagueAge');
    expect(ageDef?.backend).toBe('little_league_age');
  });

  it('maps backend to frontend names correctly', () => {
    const def = FIELD_BY_BACKEND.get('first_name');
    expect(def?.frontend).toBe('firstName');

    const coachDef = FIELD_BY_BACKEND.get('is_coach_kid');
    expect(coachDef?.frontend).toBe('isCoachKid');
  });

  it('returns required fields', () => {
    const required = getRequiredFields();
    const requiredNames = required.map((def) => def.frontend);

    expect(requiredNames).toContain('id');
    expect(requiredNames).toContain('firstName');
    expect(requiredNames).toContain('lastName');
    expect(requiredNames).toContain('bib');
    expect(requiredNames).toContain('littleLeagueAge');
    expect(requiredNames).toContain('birthday');
  });

  it('returns numeric fields', () => {
    const numeric = getNumericFields();
    const numericNames = numeric.map((def) => def.frontend);

    expect(numericNames).toContain('totalScore');
    expect(numericNames).toContain('rank');
    expect(numericNames).toContain('littleLeagueAge');
    expect(numericNames).toContain('grade');
  });

  it('returns score fields', () => {
    const scores = getScoreFields();
    const scoreNames = scores.map((def) => def.frontend);

    expect(scoreNames).toContain('totalScore');
    expect(scoreNames).toContain('fieldScore');
    expect(scoreNames).toContain('hittingSubtotal');
    expect(scoreNames).not.toContain('rank'); // rank is not a score
    expect(scoreNames).not.toContain('littleLeagueAge'); // age is not a score
  });
});

describe('Transform Functions', () => {
  describe('transformPlayerFromApi', () => {
    it('transforms snake_case to camelCase', () => {
      const apiData = {
        id: 'player-123',
        first_name: 'John',
        last_name: 'Doe',
        bib: '42',
        name: 'John Doe',
        total_score: 75,
        little_league_age: 10,
        birthday: '2014-05-15',
        is_drafted: false,
        is_coach_kid: true,
        coach_team_id: 'team-1',
      };

      const player = transformPlayerFromApi(apiData);

      expect(player.id).toBe('player-123');
      expect(player.firstName).toBe('John');
      expect(player.lastName).toBe('Doe');
      expect(player.bib).toBe('42');
      expect(player.totalScore).toBe(75);
      expect(player.littleLeagueAge).toBe(10);
      expect(player.isDrafted).toBe(false);
      expect(player.isCoachKid).toBe(true);
      expect(player.coachTeamId).toBe('team-1');
    });

    it('converts null to undefined for optional fields', () => {
      const apiData = {
        id: 'player-123',
        first_name: 'John',
        last_name: 'Doe',
        bib: '42',
        name: 'John Doe',
        little_league_age: 10,
        birthday: '2014-05-15',
        coach_team_id: null,
        sibling_id: null,
        locked_to_team_id: null,
      };

      const player = transformPlayerFromApi(apiData);

      expect(player.coachTeamId).toBeUndefined();
      expect(player.siblingId).toBeUndefined();
      expect(player.lockedToTeamId).toBeUndefined();
    });

    it('parses numeric values from strings', () => {
      const apiData = {
        id: 'player-123',
        first_name: 'John',
        last_name: 'Doe',
        bib: '42',
        name: 'John Doe',
        little_league_age: '10',
        birthday: '2014-05-15',
        total_score: '75.5',
        rank: '3',
      };

      const player = transformPlayerFromApi(apiData);

      expect(player.littleLeagueAge).toBe(10);
      expect(player.totalScore).toBe(75.5);
      expect(player.rank).toBe(3);
    });

    it('uses default values for missing numeric fields', () => {
      const apiData = {
        id: 'player-123',
        first_name: 'John',
        last_name: 'Doe',
        bib: '42',
        name: 'John Doe',
        little_league_age: 10,
        birthday: '2014-05-15',
      };

      const player = transformPlayerFromApi(apiData);

      expect(player.totalScore).toBe(0);
      expect(player.rank).toBe(0);
      expect(player.projectedRound).toBe(1); // Special default
    });

    it('handles Team Builder fields', () => {
      const apiData = {
        id: 'player-123',
        first_name: 'John',
        last_name: 'Doe',
        bib: '42',
        name: 'John Doe',
        little_league_age: 10,
        birthday: '2014-05-15',
        school: 'Lincoln Elementary',
        grade: 4,
        coach_request: 'Coach Smith',
        teammate_requests: ['Alice', 'Bob'],
      };

      const player = transformPlayerFromApi(apiData);

      expect(player.school).toBe('Lincoln Elementary');
      expect(player.grade).toBe(4);
      expect(player.coachRequest).toBe('Coach Smith');
      expect(player.teammateRequests).toEqual(['Alice', 'Bob']);
    });
  });

  describe('transformPlayerToApi', () => {
    it('transforms camelCase to snake_case', () => {
      const player = {
        id: 'player-123',
        firstName: 'John',
        lastName: 'Doe',
        bib: '42',
        totalScore: 75,
        littleLeagueAge: 10,
        isCoachKid: true,
        coachTeamId: 'team-1',
      };

      const apiData = transformPlayerToApi(player);

      expect(apiData.id).toBe('player-123');
      expect(apiData.first_name).toBe('John');
      expect(apiData.last_name).toBe('Doe');
      expect(apiData.bib).toBe('42');
      expect(apiData.total_score).toBe(75);
      expect(apiData.little_league_age).toBe(10);
      expect(apiData.is_coach_kid).toBe(true);
      expect(apiData.coach_team_id).toBe('team-1');
    });

    it('only includes defined fields (partial update support)', () => {
      const player = {
        totalScore: 80,
      };

      const apiData = transformPlayerToApi(player);

      expect(apiData.total_score).toBe(80);
      expect(apiData.first_name).toBeUndefined();
      expect(apiData.last_name).toBeUndefined();
    });

    it('includes Team Builder fields', () => {
      const player = {
        school: 'Lincoln Elementary',
        grade: 4,
        coachRequest: 'Coach Smith',
        teammateRequests: ['Alice', 'Bob'],
      };

      const apiData = transformPlayerToApi(player);

      expect(apiData.school).toBe('Lincoln Elementary');
      expect(apiData.grade).toBe(4);
      expect(apiData.coach_request).toBe('Coach Smith');
      expect(apiData.teammate_requests).toEqual(['Alice', 'Bob']);
    });
  });

  describe('field name converters', () => {
    it('converts frontend to backend field names', () => {
      expect(toBackendFieldName('firstName')).toBe('first_name');
      expect(toBackendFieldName('littleLeagueAge')).toBe('little_league_age');
      expect(toBackendFieldName('isCoachKid')).toBe('is_coach_kid');
      expect(toBackendFieldName('nonExistent')).toBeUndefined();
    });

    it('converts backend to frontend field names', () => {
      expect(toFrontendFieldName('first_name')).toBe('firstName');
      expect(toFrontendFieldName('little_league_age')).toBe('littleLeagueAge');
      expect(toFrontendFieldName('is_coach_kid')).toBe('isCoachKid');
      expect(toFrontendFieldName('non_existent')).toBeUndefined();
    });
  });
});

describe('Validation Functions', () => {
  describe('validatePlayer', () => {
    it('returns no errors for valid player', () => {
      const player = {
        id: 'player-123',
        firstName: 'John',
        lastName: 'Doe',
        bib: '42',
        littleLeagueAge: 10,
        birthday: '2014-05-15',
        totalScore: 75,
      };

      const errors = validatePlayer(player);
      const actualErrors = errors.filter((e) => e.severity === 'error');

      expect(actualErrors).toHaveLength(0);
    });

    it('returns errors for missing required fields', () => {
      const player = {
        id: 'player-123',
      };

      const errors = validatePlayer(player);
      const errorFields = errors
        .filter((e) => e.severity === 'error')
        .map((e) => e.field);

      expect(errorFields).toContain('firstName');
      expect(errorFields).toContain('lastName');
      expect(errorFields).toContain('bib');
      expect(errorFields).toContain('littleLeagueAge');
      expect(errorFields).toContain('birthday');
    });

    it('returns error for invalid age', () => {
      const player = {
        firstName: 'John',
        lastName: 'Doe',
        bib: '42',
        littleLeagueAge: 25, // Too old
        birthday: '2014-05-15',
      };

      const errors = validatePlayer(player);
      const ageErrors = errors.filter((e) => e.field === 'littleLeagueAge');

      expect(ageErrors).toHaveLength(1);
      expect(ageErrors[0].message).toContain('Invalid age');
    });

    it('returns error for coach kid without team', () => {
      const player = {
        firstName: 'John',
        lastName: 'Doe',
        bib: '42',
        littleLeagueAge: 10,
        birthday: '2014-05-15',
        isCoachKid: true,
        coachTeamId: undefined,
      };

      const errors = validatePlayer(player);
      const coachErrors = errors.filter((e) => e.field === 'coachTeamId');

      expect(coachErrors).toHaveLength(1);
      expect(coachErrors[0].message).toContain('Coach kid must have');
    });

    it('returns warning for negative score', () => {
      const player = {
        firstName: 'John',
        lastName: 'Doe',
        bib: '42',
        littleLeagueAge: 10,
        birthday: '2014-05-15',
        totalScore: -5,
      };

      const errors = validatePlayer(player);
      const scoreWarnings = errors.filter(
        (e) => e.field === 'totalScore' && e.severity === 'warning'
      );

      expect(scoreWarnings).toHaveLength(1);
      expect(scoreWarnings[0].message).toContain('negative');
    });
  });

  describe('validatePlayersBeforeSave', () => {
    it('returns valid for good player list', () => {
      const players = [
        {
          id: 'player-1',
          firstName: 'John',
          lastName: 'Doe',
          bib: '42',
          littleLeagueAge: 10,
          birthday: '2014-05-15',
        },
        {
          id: 'player-2',
          firstName: 'Jane',
          lastName: 'Smith',
          bib: '43',
          littleLeagueAge: 11,
          birthday: '2013-05-15',
        },
      ];

      const result = validatePlayersBeforeSave(players);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects duplicate BIBs', () => {
      const players = [
        {
          id: 'player-1',
          firstName: 'John',
          lastName: 'Doe',
          bib: '42',
          littleLeagueAge: 10,
          birthday: '2014-05-15',
        },
        {
          id: 'player-2',
          firstName: 'Jane',
          lastName: 'Smith',
          bib: '42', // Duplicate!
          littleLeagueAge: 11,
          birthday: '2013-05-15',
        },
      ];

      const result = validatePlayersBeforeSave(players);

      expect(result.valid).toBe(false);
      const bibErrors = result.errors.filter((e) => e.field === 'bib');
      expect(bibErrors).toHaveLength(1);
      expect(bibErrors[0].message).toContain('Duplicate BIB');
    });

    it('aggregates errors from all players', () => {
      const players = [
        {
          id: 'player-1',
          firstName: '', // Missing
          lastName: 'Doe',
          bib: '42',
          littleLeagueAge: 10,
          birthday: '2014-05-15',
        },
        {
          id: 'player-2',
          firstName: 'Jane',
          lastName: '', // Missing
          bib: '43',
          littleLeagueAge: 11,
          birthday: '2013-05-15',
        },
      ];

      const result = validatePlayersBeforeSave(players);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
