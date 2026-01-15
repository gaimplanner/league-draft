/**
 * Score normalization utilities for converting raw evaluation scores to 0-100 scale
 */

/**
 * Normalize a value to 0-100 scale
 * @param value - The raw value to normalize
 * @param inputMin - Minimum expected input value
 * @param inputMax - Maximum expected input value
 * @param lowerIsBetter - If true, lower values result in higher normalized scores (for times)
 * @returns Normalized value 0-100, or null if input is invalid
 */
export function normalizeScore(
  value: number | null | undefined,
  inputMin: number,
  inputMax: number,
  lowerIsBetter: boolean = false
): number | null {
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }

  // Clamp value to expected range
  const clampedValue = Math.max(inputMin, Math.min(inputMax, value));

  // Calculate normalized value
  const range = inputMax - inputMin;
  if (range === 0) {
    return 50; // If min === max, return middle value
  }

  if (lowerIsBetter) {
    // For times: lower value = higher score
    // E.g., fastest time (3.5s) gets 100, slowest (7.0s) gets 0
    return ((inputMax - clampedValue) / range) * 100;
  } else {
    // For scales/counts: higher value = higher score
    // E.g., rating of 5 gets 100, rating of 1 gets 0
    return ((clampedValue - inputMin) / range) * 100;
  }
}

/**
 * Normalize a scale score (typically 1-5) to 0-100
 * Higher input = higher output
 */
export function normalizeScale(
  value: number | null | undefined,
  inputMin: number = 1,
  inputMax: number = 5
): number | null {
  return normalizeScore(value, inputMin, inputMax, false);
}

/**
 * Normalize a count score (typically 0-3 or 0-5) to 0-100
 * Higher input = higher output
 */
export function normalizeCount(
  value: number | null | undefined,
  inputMin: number = 0,
  inputMax: number = 3
): number | null {
  return normalizeScore(value, inputMin, inputMax, false);
}

/**
 * Normalize a time score to 0-100
 * LOWER input = HIGHER output (inverted)
 *
 * @param value - Time in seconds
 * @param minTime - Fastest expected time (e.g., 3.5s)
 * @param maxTime - Slowest expected time (e.g., 7.0s)
 */
export function normalizeTime(
  value: number | null | undefined,
  minTime: number = 3.5,
  maxTime: number = 7.0
): number | null {
  return normalizeScore(value, minTime, maxTime, true);
}

/**
 * Get the best (fastest/minimum) time from multiple attempts
 * @param times - Array of time values (some may be null)
 * @returns The minimum valid time, or null if all are invalid
 */
export function getBestTime(...times: (number | null | undefined)[]): number | null {
  const validTimes = times.filter(
    (t): t is number => t !== null && t !== undefined && !isNaN(t) && t > 0
  );

  if (validTimes.length === 0) {
    return null;
  }

  return Math.min(...validTimes);
}

/**
 * Calculate weighted average of scores
 * @param scores - Array of { value, weight } objects
 * @returns Weighted average, or null if no valid scores
 */
export function weightedAverage(
  scores: { value: number | null; weight: number }[]
): number | null {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const { value, weight } of scores) {
    if (value !== null && !isNaN(value)) {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return null;
  }

  return weightedSum / totalWeight;
}

/**
 * Round a score to a specified number of decimal places
 */
export function roundScore(value: number | null, decimals: number = 1): number | null {
  if (value === null || isNaN(value)) {
    return null;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate dynamic min/max for time normalization based on actual data
 * This allows for better distribution of time scores
 *
 * @param times - Array of all times in the dataset
 * @param percentile - Percentile for min/max (e.g., 5 means use 5th and 95th percentile)
 * @returns { min, max } for normalization
 */
export function calculateTimeRange(
  times: (number | null | undefined)[],
  percentile: number = 5
): { min: number; max: number } {
  const validTimes = times
    .filter((t): t is number => t !== null && t !== undefined && !isNaN(t) && t > 0)
    .sort((a, b) => a - b);

  if (validTimes.length === 0) {
    return { min: 3.5, max: 7.0 }; // Default range
  }

  // Use percentiles to avoid outliers skewing the range
  const lowIndex = Math.floor((percentile / 100) * validTimes.length);
  const highIndex = Math.floor(((100 - percentile) / 100) * validTimes.length);

  return {
    min: validTimes[Math.max(0, lowIndex)],
    max: validTimes[Math.min(validTimes.length - 1, highIndex)],
  };
}
