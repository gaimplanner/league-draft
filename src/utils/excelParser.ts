import * as XLSX from 'xlsx';
import {
  ImportedWorkbook,
  ImportedTab,
  TabRow,
  findTabConfig,
  EvaluationTabConfig,
  RegistrationRecord,
} from '../types/evaluation';

/**
 * Parse an Excel file and extract structured tab data
 */
export async function parseExcelFile(file: File): Promise<ImportedWorkbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const tabs: ImportedTab[] = [];
        const allBibs = new Set<string>();
        let registrationData: RegistrationRecord[] | undefined;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];

          // Check for Registration Data tab
          if (sheetName.toLowerCase() === 'registration data') {
            registrationData = parseRegistrationDataSheet(sheet);
            continue;
          }

          const parsedTab = parseSheet(sheet, sheetName);

          if (parsedTab) {
            tabs.push(parsedTab);
            parsedTab.rows.forEach((row) => allBibs.add(row.bib));
          }
        }

        resolve({
          filename: file.name,
          tabs,
          allBibs: Array.from(allBibs).sort((a, b) => {
            // Sort numerically if possible
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) {
              return numA - numB;
            }
            return a.localeCompare(b);
          }),
          registrationData,
        });
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse Registration Data tab which contains coach requests, teammate requests, school info
 */
function parseRegistrationDataSheet(sheet: XLSX.WorkSheet): RegistrationRecord[] {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  if (data.length < 2) return [];

  const headers = (data[0] as string[]).map(h => String(h).toLowerCase().trim());

  // Find column indices
  const firstNameIdx = headers.findIndex(h => h.includes('first') && h.includes('name'));
  const lastNameIdx = headers.findIndex(h => h.includes('last') && h.includes('name'));
  const coachRequestIdx = headers.findIndex(h => h.includes('coach') && h.includes('request'));
  const teammateRequestIdx = headers.findIndex(h => h.includes('teammate') && h.includes('request'));
  const gradeIdx = headers.findIndex(h => h.includes('grade'));
  const addressIdx = headers.findIndex(h => h.includes('street') && h.includes('address'));

  // Find school - look for "school name", prefer column without "little league" prefix
  let schoolIdx = headers.findIndex(h =>
    h.includes('school') && h.includes('name') && !h.includes('little league')
  );
  if (schoolIdx === -1) {
    // Fallback to any "school name" column (like "Little League School Name")
    schoolIdx = headers.findIndex(h => h.includes('school') && h.includes('name'));
  }

  // Log detected columns for debugging
  console.log('Registration Data columns detected:', {
    firstNameIdx,
    lastNameIdx,
    coachRequestIdx,
    teammateRequestIdx,
    schoolIdx,
    gradeIdx,
    addressIdx,
    headers: headers.join(' | '),
  });

  if (firstNameIdx === -1 || lastNameIdx === -1) {
    console.warn('Registration Data: Could not find First Name / Last Name columns');
    return [];
  }

  const records: RegistrationRecord[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as (string | number)[];
    const firstName = row[firstNameIdx] ? String(row[firstNameIdx]).trim() : '';
    const lastName = row[lastNameIdx] ? String(row[lastNameIdx]).trim() : '';

    if (!firstName && !lastName) continue;

    const record: RegistrationRecord = {
      firstName,
      lastName,
    };

    // Coach request
    if (coachRequestIdx !== -1 && row[coachRequestIdx]) {
      record.coachRequest = String(row[coachRequestIdx]).trim();
    }

    // Teammate requests - parse comma/space separated
    if (teammateRequestIdx !== -1 && row[teammateRequestIdx]) {
      const rawRequests = String(row[teammateRequestIdx]).trim();
      if (rawRequests) {
        // Split by comma, then trim each name
        record.teammateRequests = rawRequests
          .split(/[,;]/)
          .map(name => name.trim())
          .filter(name => name.length > 0);
      }
    }

    // School
    if (schoolIdx !== -1 && row[schoolIdx]) {
      const schoolValue = String(row[schoolIdx]).trim();
      // Extract just the school name if it includes address
      const schoolMatch = schoolValue.match(/^([^,]+)/);
      record.school = schoolMatch ? schoolMatch[1].trim() : schoolValue;
    }

    // Grade - extract number from string like "1st", "2nd", "3rd"
    if (gradeIdx !== -1 && row[gradeIdx]) {
      const gradeStr = String(row[gradeIdx]).trim();
      const gradeMatch = gradeStr.match(/(\d+)/);
      if (gradeMatch) {
        record.grade = parseInt(gradeMatch[1]);
      }
    }

    // Address for sibling detection
    if (addressIdx !== -1 && row[addressIdx]) {
      record.address = String(row[addressIdx]).trim();
    }

    records.push(record);
  }

  console.log(`Parsed ${records.length} registration records`);
  return records;
}

/**
 * Parse a single worksheet
 */
function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): ImportedTab | null {
  // Special handling for Summary tab which has all scores in one sheet
  if (sheetName.toLowerCase() === 'summary') {
    return parseSummarySheet(sheet, sheetName);
  }

  // Find header row by looking for "BIB#" or "BIB"
  const headerRow = detectHeaderRow(sheet);
  if (headerRow === -1) {
    console.warn(`No BIB column found in sheet: ${sheetName}`);
    return null;
  }

  // Extract headers from the header row
  const { headers, bibColumn } = extractHeaders(sheet, headerRow);
  if (!bibColumn) {
    console.warn(`No BIB column in headers for sheet: ${sheetName}`);
    return null;
  }

  // Find matching tab config
  const matchedConfig = findTabConfig(sheetName);

  // Extract data rows (skip the row after headers which is often empty)
  const rows = extractRows(sheet, headerRow, headers, bibColumn, matchedConfig);

  return {
    name: sheetName,
    headerRow,
    headers,
    rows,
    bibColumn,
    matchedConfig,
    playerCount: rows.length,
  };
}

/**
 * Special parser for Summary tab which contains all evaluation data in one sheet.
 * The Summary tab has a 2-row header:
 * - Row 0: Category groups (Fielding, Fly Balls, Baserunning, Pitching, Hitting)
 * - Row 1: Column names (BIB#, First Name, Last Name, Field Score, Throw Score, etc.)
 */
function parseSummarySheet(sheet: XLSX.WorkSheet, sheetName: string): ImportedTab | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');

  // Read both header rows
  const categoryRow: string[] = [];
  const columnRow: string[] = [];

  for (let col = 0; col <= range.e.c; col++) {
    const catCell = sheet[XLSX.utils.encode_cell({ r: 0, c: col })];
    const colCell = sheet[XLSX.utils.encode_cell({ r: 1, c: col })];
    categoryRow.push(catCell?.v ? String(catCell.v).trim() : '');
    columnRow.push(colCell?.v ? String(colCell.v).trim() : '');
  }

  // Find BIB column
  const bibIndex = columnRow.findIndex(
    h => h.toLowerCase() === 'bib#' || h.toLowerCase() === 'bib'
  );
  if (bibIndex === -1) {
    console.warn('No BIB column found in Summary sheet');
    return null;
  }

  // Build column mapping based on category groups
  // This maps: category -> { columnName -> columnIndex }
  interface ColumnMapping {
    fielding: Record<string, number>;
    flyBalls: Record<string, number>;
    baserunning: Record<string, number>;
    pitching: Record<string, number>;
    hitting: Record<string, number>;
  }

  const columnMapping: ColumnMapping = {
    fielding: {},
    flyBalls: {},
    baserunning: {},
    pitching: {},
    hitting: {},
  };

  // Track current category as we iterate through columns
  let currentCategory: keyof ColumnMapping | null = null;

  for (let col = 0; col <= range.e.c; col++) {
    const category = categoryRow[col].toLowerCase();
    const columnName = columnRow[col].toLowerCase();

    // Update current category when we see a category header
    if (category === 'fielding') currentCategory = 'fielding';
    else if (category === 'fly balls') currentCategory = 'flyBalls';
    else if (category === 'baserunning') currentCategory = 'baserunning';
    else if (category === 'pitching') currentCategory = 'pitching';
    else if (category === 'hitting') currentCategory = 'hitting';

    // Map column to current category
    if (currentCategory && columnName) {
      columnMapping[currentCategory][columnName] = col;
    }
  }

  // Extract data rows
  const rows: TabRow[] = [];

  for (let row = 2; row <= range.e.r; row++) {
    const bibCell = sheet[XLSX.utils.encode_cell({ r: row, c: bibIndex })];
    const bibValue = bibCell?.v !== undefined ? String(bibCell.v).trim() : '';

    // Skip empty rows
    if (!bibValue || bibValue.toLowerCase() === 'bib#') continue;

    const rowData: TabRow = {
      bib: bibValue,
      scores: {},
    };

    // Extract name
    for (let col = 0; col < columnRow.length; col++) {
      const header = columnRow[col].toLowerCase();
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      const value = cell?.v;

      if (header.includes('first') && header.includes('name')) {
        rowData.firstName = value ? String(value).trim() : undefined;
      } else if (header.includes('last') && header.includes('name')) {
        rowData.lastName = value ? String(value).trim() : undefined;
      }
    }

    // Skip rows without names
    if (!rowData.firstName && !rowData.lastName) continue;

    // Extract scores using column mapping
    // Fielding
    if (columnMapping.fielding['field score'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.fielding['field score'] })];
      rowData.scores['field'] = cell?.v !== undefined ? Number(cell.v) : null;
    }
    if (columnMapping.fielding['throw score'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.fielding['throw score'] })];
      rowData.scores['throw'] = cell?.v !== undefined ? Number(cell.v) : null;
    }

    // Fly Balls
    if (columnMapping.flyBalls['form'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.flyBalls['form'] })];
      rowData.scores['flyBallForm'] = cell?.v !== undefined ? Number(cell.v) : null;
    }
    if (columnMapping.flyBalls['# catches'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.flyBalls['# catches'] })];
      rowData.scores['catches'] = cell?.v !== undefined ? Number(cell.v) : null;
    }

    // Baserunning
    if (columnMapping.baserunning['form'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.baserunning['form'] })];
      rowData.scores['baserunningForm'] = cell?.v !== undefined ? Number(cell.v) : null;
    }
    if (columnMapping.baserunning['time 1'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.baserunning['time 1'] })];
      rowData.scores['time1'] = cell?.v !== undefined ? Number(cell.v) : null;
    }
    if (columnMapping.baserunning['time 2'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.baserunning['time 2'] })];
      rowData.scores['time2'] = cell?.v !== undefined ? Number(cell.v) : null;
    }

    // Pitching
    if (columnMapping.pitching['form'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.pitching['form'] })];
      rowData.scores['pitchingForm'] = cell?.v !== undefined ? Number(cell.v) : null;
    }
    if (columnMapping.pitching['arm strength'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.pitching['arm strength'] })];
      rowData.scores['armStrength'] = cell?.v !== undefined ? Number(cell.v) : null;
    }

    // Hitting
    if (columnMapping.hitting['form'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.hitting['form'] })];
      rowData.scores['hittingForm'] = cell?.v !== undefined ? Number(cell.v) : null;
    }
    if (columnMapping.hitting['contact/power'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.hitting['contact/power'] })];
      rowData.scores['contactPower'] = cell?.v !== undefined ? Number(cell.v) : null;
    }
    if (columnMapping.hitting['# hits'] !== undefined) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.hitting['# hits'] })];
      rowData.scores['hits'] = cell?.v !== undefined ? Number(cell.v) : null;
    }

    rows.push(rowData);
  }

  // Create a special "combined" config that marks this as a Summary tab
  const summaryConfig: EvaluationTabConfig = {
    name: 'Summary',
    category: 'fielding', // Placeholder - we'll handle this specially in processing
    expectedColumns: [],
    fields: [],
  };

  return {
    name: sheetName,
    headerRow: 1,
    headers: columnRow,
    rows,
    bibColumn: 'BIB#',
    matchedConfig: summaryConfig,
    playerCount: rows.length,
    // Mark this as a combined tab that has all categories
    isCombinedTab: true,
  } as ImportedTab & { isCombinedTab: boolean };
}

/**
 * Auto-detect header row by finding "BIB#" or "BIB" in first 15 rows
 */
function detectHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');

  // Search first 15 rows for BIB column
  for (let row = 0; row <= Math.min(14, range.e.r); row++) {
    for (let col = 0; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      if (cell && cell.v) {
        const value = String(cell.v).toLowerCase().trim();
        if (value === 'bib#' || value === 'bib' || value === 'bib #') {
          return row;
        }
      }
    }
  }

  return -1;
}

/**
 * Extract headers from a specific row
 */
function extractHeaders(
  sheet: XLSX.WorkSheet,
  headerRow: number
): { headers: string[]; bibColumn: string | null } {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');
  const headers: string[] = [];
  let bibColumn: string | null = null;

  for (let col = 0; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
    const cell = sheet[cellAddress];
    const value = cell && cell.v ? String(cell.v).trim() : '';
    headers.push(value);

    if (value.toLowerCase() === 'bib#' || value.toLowerCase() === 'bib') {
      bibColumn = value;
    }
  }

  return { headers, bibColumn };
}

/**
 * Extract data rows from sheet starting after header row
 * Skips the empty row that typically follows headers
 */
function extractRows(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  headers: string[],
  _bibColumn: string, // Kept for potential future use
  config: EvaluationTabConfig | null
): TabRow[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');
  const rows: TabRow[] = [];
  const bibIndex = headers.findIndex(
    (h) => h.toLowerCase() === 'bib#' || h.toLowerCase() === 'bib'
  );

  if (bibIndex === -1) return rows;

  // Start from headerRow + 2 to skip the empty row after headers
  // But also check headerRow + 1 in case there's no empty row
  const startRow = headerRow + 1;

  for (let row = startRow; row <= range.e.r; row++) {
    // Get BIB value
    const bibCellAddress = XLSX.utils.encode_cell({ r: row, c: bibIndex });
    const bibCell = sheet[bibCellAddress];
    const bibValue = bibCell && bibCell.v !== undefined ? String(bibCell.v).trim() : '';

    // Skip empty rows, rows without BIB, or header-like rows
    const bibLower = bibValue.toLowerCase();
    if (!bibValue || bibValue === '' || bibLower === 'group' || bibLower === 'bib#' || bibLower === 'bib' || bibLower === 'bib #') {
      continue;
    }

    // Build row data
    const rowData: TabRow = {
      bib: bibValue,
      scores: {},
    };

    // Extract name and age if present
    for (let col = 0; col < headers.length; col++) {
      const header = headers[col].toLowerCase();
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      const value = cell && cell.v !== undefined ? cell.v : null;

      if (header.includes('first') && header.includes('name')) {
        rowData.firstName = value ? String(value).trim() : undefined;
      } else if (header.includes('last') && header.includes('name')) {
        rowData.lastName = value ? String(value).trim() : undefined;
      } else if (header.includes('age') || header === 'league age') {
        rowData.age = value ? parseInt(String(value)) : undefined;
      } else if (header === 'level') {
        rowData.level = value ? String(value).trim() : undefined;
      }
    }

    // Extract score columns based on config
    if (config) {
      for (const field of config.fields) {
        const matchedHeader = findMatchingColumn(headers, field.columnPatterns);
        if (matchedHeader !== null) {
          const colIndex = headers.indexOf(matchedHeader);
          if (colIndex !== -1) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
            const cell = sheet[cellAddress];
            const rawValue = cell && cell.v !== undefined ? cell.v : null;

            // Parse numeric value
            if (rawValue !== null && rawValue !== '') {
              const numValue = parseFloat(String(rawValue));
              rowData.scores[field.name] = isNaN(numValue) ? null : numValue;
            } else {
              rowData.scores[field.name] = null;
            }
          }
        }
      }
    } else {
      // No config - extract all numeric columns as scores
      for (let col = 0; col < headers.length; col++) {
        const header = headers[col];
        if (!header) continue;

        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellAddress];
        const rawValue = cell && cell.v !== undefined ? cell.v : null;

        if (rawValue !== null && rawValue !== '' && typeof rawValue === 'number') {
          rowData.scores[header.toLowerCase()] = rawValue;
        }
      }
    }

    // Skip rows with BIB but no name (placeholder for walk-ins who didn't show)
    if (!rowData.firstName && !rowData.lastName) {
      continue;
    }

    rows.push(rowData);
  }

  return rows;
}

/**
 * Find a column header that matches one of the patterns
 */
function findMatchingColumn(headers: string[], patterns: string[]): string | null {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase().trim();

    // First try exact match
    const exactIndex = normalizedHeaders.indexOf(normalizedPattern);
    if (exactIndex !== -1) {
      return headers[exactIndex];
    }

    // Then try partial match
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (normalizedHeaders[i].includes(normalizedPattern)) {
        return headers[i];
      }
    }
  }

  return null;
}

/**
 * Validate that a workbook has the expected tabs
 */
export function validateWorkbook(workbook: ImportedWorkbook): {
  isValid: boolean;
  missingTabs: string[];
  extraTabs: string[];
} {
  const expectedTabs = ['Fielding', 'Pitching', 'Hitting', 'Fly Balls', 'Baserunning'];
  const foundTabs = workbook.tabs.map((t) => t.name);

  // Check if we have a combined Summary tab - this counts as having all tabs
  const hasCombinedTab = workbook.tabs.some((t) => t.isCombinedTab);
  if (hasCombinedTab) {
    return {
      isValid: true,
      missingTabs: [],
      extraTabs: foundTabs.filter(t => t.toLowerCase() !== 'summary'),
    };
  }

  const missingTabs = expectedTabs.filter(
    (expected) =>
      !foundTabs.some(
        (found) =>
          found.toLowerCase() === expected.toLowerCase() ||
          found.toLowerCase().includes(expected.toLowerCase())
      )
  );

  const extraTabs = foundTabs.filter(
    (found) =>
      !expectedTabs.some(
        (expected) =>
          found.toLowerCase() === expected.toLowerCase() ||
          found.toLowerCase().includes(expected.toLowerCase())
      )
  );

  // Log validation results for debugging
  if (missingTabs.length > 0) {
    console.warn('Missing tabs:', missingTabs);
  }

  return {
    isValid: missingTabs.length === 0,
    missingTabs,
    extraTabs,
  };
}
