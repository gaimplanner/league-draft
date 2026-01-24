/**
 * Auto-generated transforms from field definitions
 *
 * These transforms are generated from PLAYER_FIELD_DEFINITIONS to ensure
 * consistency between frontend and backend field naming.
 */

import type { Player } from '../../types';
import { PLAYER_FIELD_DEFINITIONS, type FieldDefinition } from './fieldDefinitions';

// -----------------------------------------------------------------------------
// Safe Parsing Utilities
// -----------------------------------------------------------------------------

/**
 * Safely parse a numeric value that may come as string from Django DecimalField
 * Returns the defaultValue if the value is null, undefined, or cannot be parsed.
 */
function safeParseNumber(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Safely parse an optional numeric value
 * Returns undefined if the value is null, undefined, or cannot be parsed.
 */
function safeParseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Transform Functions
// -----------------------------------------------------------------------------

/**
 * Transform a single field value from API (snake_case) to frontend format
 */
function transformFieldFromApi(def: FieldDefinition, value: unknown): unknown {
  switch (def.type) {
    case 'string':
      return value as string;

    case 'string?':
      // Convert null to undefined for optional strings
      return (value as string | null) ?? undefined;

    case 'number':
      return safeParseNumber(value, def.defaultValue as number ?? 0);

    case 'number?':
      return safeParseOptionalNumber(value);

    case 'boolean':
      return value as boolean ?? def.defaultValue ?? false;

    case 'string[]':
      return (value as string[] | null) ?? def.defaultValue ?? [];

    default:
      return value;
  }
}

/**
 * Transform player data from API (snake_case) to frontend (camelCase)
 * Generated from PLAYER_FIELD_DEFINITIONS
 */
export function transformPlayerFromApi(data: Record<string, unknown>): Player {
  const result: Record<string, unknown> = {};

  for (const def of PLAYER_FIELD_DEFINITIONS) {
    const apiValue = data[def.backend];
    result[def.frontend] = transformFieldFromApi(def, apiValue);
  }

  return result as unknown as Player;
}

/**
 * Transform player data from frontend (camelCase) to API (snake_case)
 * Generated from PLAYER_FIELD_DEFINITIONS
 *
 * Only includes fields that are defined (not undefined) to support partial updates.
 */
export function transformPlayerToApi(player: Partial<Player>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const playerRecord = player as Record<string, unknown>;

  for (const def of PLAYER_FIELD_DEFINITIONS) {
    const frontendValue = playerRecord[def.frontend];
    if (frontendValue !== undefined) {
      result[def.backend] = frontendValue;
    }
  }

  return result;
}

/**
 * Get all frontend field names
 */
export function getFrontendFieldNames(): string[] {
  return PLAYER_FIELD_DEFINITIONS.map((def) => def.frontend);
}

/**
 * Get all backend field names
 */
export function getBackendFieldNames(): string[] {
  return PLAYER_FIELD_DEFINITIONS.map((def) => def.backend);
}

/**
 * Convert a single field name from frontend to backend format
 */
export function toBackendFieldName(frontendName: string): string | undefined {
  const def = PLAYER_FIELD_DEFINITIONS.find((d) => d.frontend === frontendName);
  return def?.backend;
}

/**
 * Convert a single field name from backend to frontend format
 */
export function toFrontendFieldName(backendName: string): string | undefined {
  const def = PLAYER_FIELD_DEFINITIONS.find((d) => d.backend === backendName);
  return def?.frontend;
}
