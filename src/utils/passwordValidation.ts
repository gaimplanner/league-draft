/**
 * Password validation utility to match Django's password validators.
 * Django uses these validators by default:
 * - MinimumLengthValidator (8 chars)
 * - CommonPasswordValidator
 * - NumericPasswordValidator
 */

// Common passwords list (subset of Django's list - most common ones)
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'abc123', 'monkey', 'master', 'dragon', 'letmein', 'login',
  'welcome', 'shadow', 'sunshine', 'princess', 'football', 'baseball',
  'iloveyou', 'trustno1', 'superman', 'batman', 'passw0rd', 'admin',
  'admin123', 'root', 'toor', 'pass', 'test', 'guest', 'qwerty123',
  '1234567', '12345', '1234', '123123', '1q2w3e4r', 'qwertyuiop',
  'password1234', 'password12', 'zxcvbnm', 'asdfghjkl', 'qazwsx',
]);

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a password against security requirements.
 * Matches Django's default password validators.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // MinimumLengthValidator - at least 8 characters
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  // NumericPasswordValidator - can't be entirely numeric
  if (/^\d+$/.test(password)) {
    errors.push('Password cannot be entirely numeric');
  }

  // CommonPasswordValidator - can't be a common password
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get password requirements for display to user.
 */
export function getPasswordRequirements(): string[] {
  return [
    'At least 8 characters',
    'Cannot be entirely numeric',
    'Cannot be a common password',
  ];
}
