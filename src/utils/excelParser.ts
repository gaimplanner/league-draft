import * as XLSX from 'xlsx';
import {
  ImportedWorkbook,
  ImportedTab,
  TabRow,
  findTabConfig,
  EvaluationTabConfig,
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

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
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
 * Parse a single worksheet
 */
function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): ImportedTab | null {
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
