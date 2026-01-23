/**
 * Import Pipeline Module
 *
 * Unified player field definitions, transforms, and validation.
 * This module provides a single source of truth for player data handling.
 */

// Field definitions (single source of truth)
export {
  PLAYER_FIELD_DEFINITIONS,
  FIELD_BY_FRONTEND,
  FIELD_BY_BACKEND,
  getRequiredFields,
  getNumericFields,
  getScoreFields,
  type FieldDefinition,
  type FieldType,
} from './fieldDefinitions';

// Transform functions (auto-generated from definitions)
export {
  transformPlayerFromApi,
  transformPlayerToApi,
  getFrontendFieldNames,
  getBackendFieldNames,
  toBackendFieldName,
  toFrontendFieldName,
} from './transforms';

// Validation functions
export {
  validatePlayer,
  validatePlayersBeforeSave,
  formatValidationResult,
  type ValidationError,
  type ValidationResult,
} from './validation';
