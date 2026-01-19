/**
 * Team Builder Excel Parser
 *
 * Handles parsing of Registration Data tab which contains:
 * - First Name, Last Name (no BIB)
 * - Coach Request
 * - Teammate Requests (comma or space delimited)
 * - School
 * - Grade
 * - Address (used only for sibling detection, not persisted)
 *
 * This data must be linked to evaluation data via name matching.
 */

import * as XLSX from 'xlsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RegistrationRow {
  firstName: string;
  lastName: string;
  fullName: string; // Normalized: "FirstName LastName"
  coachRequest: string;
  teammateRequests: string[]; // Parsed from comma/space delimited string
  school: string;
  grade: number | null;
  address: string; // Used only for sibling detection, not stored
  rawTeammateRequestsString: string; // Original string for debugging
}

export interface RegistrationData {
  rows: RegistrationRow[];
  headers: string[];
  warnings: RegistrationWarning[];
}

export interface RegistrationWarning {
  type: 'missing_name' | 'invalid_grade' | 'empty_row' | 'parse_error';
  message: string;
  rowIndex?: number;
}

export interface PlayerMatch {
  registrationIndex: number;
  evalBib: string | null; // null if no match found
  evalFirstName: string | null;
  evalLastName: string | null;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchScore: number; // 0-1, higher is better
  suggestedMatches?: Array<{
    bib: string;
    firstName: string;
    lastName: string;
    score: number;
  }>;
}

export interface TeammateRequest {
  rawString: string; // Original request string
  resolvedPlayerId: string | null; // Matched player ID (or null if unresolved)
  resolvedPlayerName: string | null; // Matched player name for display
  isTwoWay: boolean; // True if both players requested each other
  matchType: 'exact' | 'fuzzy' | 'none';
  suggestedMatches?: Array<{
    playerId: string;
    name: string;
    score: number;
  }>;
}

// -----------------------------------------------------------------------------
// Registration Data Tab Parser
// -----------------------------------------------------------------------------

/**
 * Parse the Registration Data tab from an Excel sheet.
 * This tab has NO BIB column - players are identified by name.
 */
export function parseRegistrationDataTab(
  sheet: XLSX.WorkSheet,
  sheetName: string
): RegistrationData | null {
  const warnings: RegistrationWarning[] = [];

  // Find header row by looking for "First Name" column
  const headerRow = detectRegistrationHeaderRow(sheet);
  if (headerRow === -1) {
    console.warn(`No First Name column found in sheet: ${sheetName}`);
    return null;
  }

  // Extract headers
  const headers = extractHeadersFromRow(sheet, headerRow);

  // Find column indices
  const columnMap = mapRegistrationColumns(headers);
  if (!columnMap.firstName || !columnMap.lastName) {
    console.warn(`Missing required name columns in sheet: ${sheetName}`);
    return null;
  }

  // Extract data rows
  const rows = extractRegistrationRows(sheet, headerRow, headers, columnMap, warnings);

  return {
    rows,
    headers,
    warnings,
  };
}

/**
 * Detect header row by finding "First Name" column (case-insensitive)
 */
function detectRegistrationHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');

  // Search first 15 rows for First Name column
  for (let row = 0; row <= Math.min(14, range.e.r); row++) {
    for (let col = 0; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      if (cell && cell.v) {
        const value = String(cell.v).toLowerCase().trim();
        if (value === 'first name' || value === 'firstname' || value === 'first') {
          return row;
        }
      }
    }
  }

  return -1;
}

/**
 * Extract all headers from a row
 */
function extractHeadersFromRow(sheet: XLSX.WorkSheet, headerRow: number): string[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');
  const headers: string[] = [];

  for (let col = 0; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
    const cell = sheet[cellAddress];
    headers.push(cell && cell.v ? String(cell.v).trim() : '');
  }

  return headers;
}

/**
 * Map column headers to their indices
 */
function mapRegistrationColumns(headers: string[]): {
  firstName: number | null;
  lastName: number | null;
  coachRequest: number | null;
  teammateRequests: number | null;
  school: number | null;
  grade: number | null;
  address: number | null;
} {
  const map = {
    firstName: null as number | null,
    lastName: null as number | null,
    coachRequest: null as number | null,
    teammateRequests: null as number | null,
    school: null as number | null,
    grade: null as number | null,
    address: null as number | null,
  };

  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();

    // First Name
    if (h === 'first name' || h === 'firstname' || h === 'first') {
      map.firstName = index;
    }
    // Last Name
    else if (h === 'last name' || h === 'lastname' || h === 'last') {
      map.lastName = index;
    }
    // Coach Request
    else if (h.includes('coach') && (h.includes('request') || h.includes('preference'))) {
      map.coachRequest = index;
    }
    // Teammate Requests
    else if (
      (h.includes('teammate') || h.includes('friend')) &&
      (h.includes('request') || h.includes('preference'))
    ) {
      map.teammateRequests = index;
    }
    // School
    else if (h === 'school' || h.includes('school name')) {
      map.school = index;
    }
    // Grade
    else if (h === 'grade' || h === 'grade level') {
      map.grade = index;
    }
    // Address (for sibling detection only)
    else if (h === 'address' || h.includes('street') || h.includes('home address')) {
      map.address = index;
    }
  });

  return map;
}

/**
 * Extract registration data rows
 */
function extractRegistrationRows(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  _headers: string[], // Available for future use
  columnMap: ReturnType<typeof mapRegistrationColumns>,
  warnings: RegistrationWarning[]
): RegistrationRow[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');
  const rows: RegistrationRow[] = [];

  // Start from headerRow + 1
  for (let row = headerRow + 1; row <= range.e.r; row++) {
    const getCellValue = (colIndex: number | null): string => {
      if (colIndex === null) return '';
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
      const cell = sheet[cellAddress];
      return cell && cell.v !== undefined ? String(cell.v).trim() : '';
    };

    const firstName = getCellValue(columnMap.firstName);
    const lastName = getCellValue(columnMap.lastName);

    // Skip empty rows
    if (!firstName && !lastName) {
      continue;
    }

    // Warn if missing name component
    if (!firstName || !lastName) {
      warnings.push({
        type: 'missing_name',
        message: `Row ${row + 1}: Missing ${!firstName ? 'first' : 'last'} name`,
        rowIndex: row,
      });
      continue;
    }

    const coachRequest = getCellValue(columnMap.coachRequest);
    const rawTeammateRequests = getCellValue(columnMap.teammateRequests);
    const school = getCellValue(columnMap.school);
    const gradeStr = getCellValue(columnMap.grade);
    const address = getCellValue(columnMap.address);

    // Parse grade
    let grade: number | null = null;
    if (gradeStr) {
      const parsed = parseInt(gradeStr);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 12) {
        grade = parsed;
      } else {
        warnings.push({
          type: 'invalid_grade',
          message: `Row ${row + 1}: Invalid grade "${gradeStr}"`,
          rowIndex: row,
        });
      }
    }

    // Parse teammate requests
    const teammateRequests = parseTeammateRequestsString(rawTeammateRequests);

    rows.push({
      firstName: normalizeName(firstName),
      lastName: normalizeName(lastName),
      fullName: `${normalizeName(firstName)} ${normalizeName(lastName)}`,
      coachRequest: coachRequest.trim(),
      teammateRequests,
      school: school.trim(),
      grade,
      address: address.trim(),
      rawTeammateRequestsString: rawTeammateRequests,
    });
  }

  return rows;
}

// -----------------------------------------------------------------------------
// Name Normalization & Parsing
// -----------------------------------------------------------------------------

/**
 * Normalize a name: capitalize first letter, lowercase rest
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  // Handle names with multiple parts (e.g., "Mary Jane")
  return trimmed
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parse teammate requests from a string.
 * Handles both comma-separated and space-separated formats.
 *
 * Examples:
 * - "Mike Smith, Jake Johnson" -> ["Mike Smith", "Jake Johnson"]
 * - "Smith Johnson" -> ["Smith", "Johnson"] (last names only)
 * - "Mike Smith Jake Johnson" -> attempts to detect full names vs last names
 */
export function parseTeammateRequestsString(raw: string): string[] {
  if (!raw || raw.trim() === '') return [];

  const trimmed = raw.trim();

  // If contains comma, split by comma
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(normalizeName);
  }

  // Otherwise, try to intelligently split
  // If we have pairs of capitalized words, they might be "First Last" names
  // Otherwise, treat each word as a separate name (likely last names)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return [];
  if (words.length === 1) return [normalizeName(words[0])];

  // Heuristic: if all words start with capital and we have even count,
  // try to pair them as "First Last" names
  const allCapitalized = words.every(w => /^[A-Z]/.test(w));
  if (allCapitalized && words.length % 2 === 0 && words.length <= 6) {
    const names: string[] = [];
    for (let i = 0; i < words.length; i += 2) {
      names.push(normalizeName(`${words[i]} ${words[i + 1]}`));
    }
    return names;
  }

  // Default: treat each word as a separate name (likely last names)
  return words.map(normalizeName);
}

// -----------------------------------------------------------------------------
// Name Matching (Fuzzy)
// -----------------------------------------------------------------------------

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Initialize matrix
  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bLen][aLen];
}

/**
 * Calculate similarity score between two names (0-1, higher is better)
 */
export function nameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return 1;
  if (n1.length === 0 || n2.length === 0) return 0;

  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);

  return 1 - distance / maxLength;
}

/**
 * Match a registration row to evaluation data by name.
 * Returns exact match, fuzzy matches, or no match.
 */
export function matchRegistrationToEval(
  registration: RegistrationRow,
  evalPlayers: Array<{ bib: string; firstName: string; lastName: string }>
): PlayerMatch {
  const regFullName = registration.fullName.toLowerCase();
  const regFirst = registration.firstName.toLowerCase();
  const regLast = registration.lastName.toLowerCase();

  // Try exact full name match first
  const exactMatch = evalPlayers.find(
    p =>
      p.firstName.toLowerCase() === regFirst &&
      p.lastName.toLowerCase() === regLast
  );

  if (exactMatch) {
    return {
      registrationIndex: -1, // Will be set by caller
      evalBib: exactMatch.bib,
      evalFirstName: exactMatch.firstName,
      evalLastName: exactMatch.lastName,
      matchType: 'exact',
      matchScore: 1,
    };
  }

  // Try fuzzy matching
  const candidates = evalPlayers.map(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const fullNameScore = nameSimilarity(regFullName, fullName);

    // Also try matching just last name (common case for partial matches)
    const lastNameScore = nameSimilarity(regLast, p.lastName.toLowerCase());

    // Use the better score
    const score = Math.max(fullNameScore, lastNameScore * 0.8); // Discount last-name-only matches

    return {
      bib: p.bib,
      firstName: p.firstName,
      lastName: p.lastName,
      score,
    };
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // If best match is good enough (>= 0.8), consider it a fuzzy match
  const bestCandidate = candidates[0];
  if (bestCandidate && bestCandidate.score >= 0.8) {
    return {
      registrationIndex: -1,
      evalBib: bestCandidate.bib,
      evalFirstName: bestCandidate.firstName,
      evalLastName: bestCandidate.lastName,
      matchType: 'fuzzy',
      matchScore: bestCandidate.score,
      suggestedMatches: candidates.slice(0, 3).filter(c => c.score >= 0.5),
    };
  }

  // No good match - return suggestions
  return {
    registrationIndex: -1,
    evalBib: null,
    evalFirstName: null,
    evalLastName: null,
    matchType: 'none',
    matchScore: 0,
    suggestedMatches: candidates.slice(0, 5).filter(c => c.score >= 0.3),
  };
}

// -----------------------------------------------------------------------------
// Two-Way Request Detection
// -----------------------------------------------------------------------------

/**
 * Detect two-way teammate requests.
 * A two-way request exists when Player A requests Player B AND Player B requests Player A.
 */
export function detectTwoWayRequests(
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    teammateRequests: string[];
  }>
): Map<string, Set<string>> {
  // Map of player ID -> Set of player IDs they have two-way requests with
  const twoWayMap = new Map<string, Set<string>>();

  for (const playerA of players) {
    for (const requestName of playerA.teammateRequests) {
      // Find player B who matches this request
      const playerB = findPlayerByName(players, requestName);
      if (!playerB) continue;

      // Check if player B also requested player A
      const bRequestsA = playerB.teammateRequests.some(req => {
        const matched = findPlayerByName(players, req);
        return matched?.id === playerA.id;
      });

      if (bRequestsA) {
        // Two-way request found
        if (!twoWayMap.has(playerA.id)) {
          twoWayMap.set(playerA.id, new Set());
        }
        if (!twoWayMap.has(playerB.id)) {
          twoWayMap.set(playerB.id, new Set());
        }
        twoWayMap.get(playerA.id)!.add(playerB.id);
        twoWayMap.get(playerB.id)!.add(playerA.id);
      }
    }
  }

  return twoWayMap;
}

/**
 * Find a player by name (exact or fuzzy match)
 */
function findPlayerByName<T extends { firstName: string; lastName: string; fullName: string }>(
  players: T[],
  name: string
): T | null {
  const normalizedName = name.toLowerCase().trim();

  // Try exact full name match
  const exactFull = players.find(p => p.fullName.toLowerCase() === normalizedName);
  if (exactFull) return exactFull;

  // Try exact last name match (if unique)
  const lastNameMatches = players.filter(p => p.lastName.toLowerCase() === normalizedName);
  if (lastNameMatches.length === 1) return lastNameMatches[0];

  // Try fuzzy match
  let bestMatch: T | null = null;
  let bestScore = 0;

  for (const player of players) {
    const fullNameScore = nameSimilarity(normalizedName, player.fullName.toLowerCase());
    const lastNameScore = nameSimilarity(normalizedName, player.lastName.toLowerCase()) * 0.8;
    const score = Math.max(fullNameScore, lastNameScore);

    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      bestMatch = player;
    }
  }

  return bestMatch;
}

// -----------------------------------------------------------------------------
// Coach Request Resolution
// -----------------------------------------------------------------------------

export interface CoachInfo {
  teamId: string;
  teamName: string;
  coachName: string; // Head coach name
  assistantCoach?: string;
}

export interface CoachRequestMatch {
  rawRequest: string;
  matchedTeamId: string | null;
  matchedCoachName: string | null;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchScore: number;
  suggestedMatches?: Array<{
    teamId: string;
    coachName: string;
    score: number;
  }>;
}

/**
 * Resolve a coach request string to a team ID.
 * Matches against head coach and assistant coach names.
 */
export function resolveCoachRequest(
  request: string,
  coaches: CoachInfo[]
): CoachRequestMatch {
  if (!request || request.trim() === '') {
    return {
      rawRequest: request,
      matchedTeamId: null,
      matchedCoachName: null,
      matchType: 'none',
      matchScore: 0,
    };
  }

  const normalizedRequest = request.toLowerCase().trim();

  // Try exact match on coach name (head or assistant)
  for (const coach of coaches) {
    const headCoachName = coach.coachName.toLowerCase().trim();
    const assistantName = (coach.assistantCoach || '').toLowerCase().trim();

    // Exact full name match
    if (headCoachName === normalizedRequest || assistantName === normalizedRequest) {
      return {
        rawRequest: request,
        matchedTeamId: coach.teamId,
        matchedCoachName: coach.coachName,
        matchType: 'exact',
        matchScore: 1,
      };
    }

    // Last name match (extract last word from coach name)
    const headLastName = headCoachName.split(/\s+/).pop() || '';
    const assistantLastName = assistantName.split(/\s+/).pop() || '';

    if (headLastName === normalizedRequest || assistantLastName === normalizedRequest) {
      return {
        rawRequest: request,
        matchedTeamId: coach.teamId,
        matchedCoachName: coach.coachName,
        matchType: 'exact',
        matchScore: 1,
      };
    }
  }

  // Try fuzzy matching
  const candidates = coaches.map(coach => {
    const headScore = nameSimilarity(normalizedRequest, coach.coachName.toLowerCase());
    const assistantScore = coach.assistantCoach
      ? nameSimilarity(normalizedRequest, coach.assistantCoach.toLowerCase())
      : 0;

    // Also try last name only matching
    const headLastName = coach.coachName.split(/\s+/).pop() || '';
    const lastNameScore = nameSimilarity(normalizedRequest, headLastName.toLowerCase()) * 0.9;

    const bestScore = Math.max(headScore, assistantScore, lastNameScore);

    return {
      teamId: coach.teamId,
      coachName: coach.coachName,
      score: bestScore,
    };
  });

  candidates.sort((a, b) => b.score - a.score);

  const bestCandidate = candidates[0];
  if (bestCandidate && bestCandidate.score >= 0.7) {
    return {
      rawRequest: request,
      matchedTeamId: bestCandidate.teamId,
      matchedCoachName: bestCandidate.coachName,
      matchType: 'fuzzy',
      matchScore: bestCandidate.score,
      suggestedMatches: candidates.slice(0, 3).filter(c => c.score >= 0.4),
    };
  }

  // No good match
  return {
    rawRequest: request,
    matchedTeamId: null,
    matchedCoachName: null,
    matchType: 'none',
    matchScore: 0,
    suggestedMatches: candidates.slice(0, 3).filter(c => c.score >= 0.3),
  };
}

/**
 * Resolve all coach requests for a list of players.
 * Returns a map of player ID to resolved coach team ID.
 */
export function resolveAllCoachRequests(
  players: Array<{ id: string; coachRequest: string }>,
  coaches: CoachInfo[]
): Map<string, CoachRequestMatch> {
  const results = new Map<string, CoachRequestMatch>();

  for (const player of players) {
    if (player.coachRequest && player.coachRequest.trim() !== '') {
      results.set(player.id, resolveCoachRequest(player.coachRequest, coaches));
    }
  }

  return results;
}

// -----------------------------------------------------------------------------
// Sibling Detection by Address
// -----------------------------------------------------------------------------

/**
 * Detect siblings by matching last name AND address.
 * Returns groups of sibling player indices.
 */
export function detectSiblingsByAddress(
  registrations: RegistrationRow[]
): Map<string, number[]> {
  // Group by normalized address + last name
  const groups = new Map<string, number[]>();

  registrations.forEach((reg, index) => {
    if (!reg.address || reg.address.trim() === '') return;

    // Create a key from normalized address + last name
    const normalizedAddress = normalizeAddress(reg.address);
    const key = `${reg.lastName.toLowerCase()}|${normalizedAddress}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(index);
  });

  // Filter to only groups with multiple siblings
  const siblingGroups = new Map<string, number[]>();
  let groupId = 0;

  groups.forEach((indices) => {
    if (indices.length > 1) {
      siblingGroups.set(String.fromCharCode(65 + groupId), indices); // 'A', 'B', 'C', etc.
      groupId++;
    }
  });

  return siblingGroups;
}

/**
 * Normalize an address for comparison
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    // Remove common variations
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bapartment\b/g, 'apt')
    .replace(/\bunit\b/g, 'unit')
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ');
}
