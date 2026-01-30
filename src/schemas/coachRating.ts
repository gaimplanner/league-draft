import { z } from 'zod';
import type { CoachCategoryDefinition } from '../types';

/**
 * Build a Zod schema dynamically from template coach categories.
 * For draft saves, scores are optional (any subset is valid).
 * For submit validation, all categories must have scores.
 */
export function buildRatingSchema(
  categories: CoachCategoryDefinition[],
  requireAll: boolean = false
) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const cat of categories) {
    const field = z.number().min(cat.min).max(cat.max);
    shape[cat.id] = requireAll ? field : field.optional();
  }
  return z.object(shape);
}

/**
 * Schema for adding a new player to rate.
 */
export const addPlayerSchema = z.object({
  playerFirstName: z.string().min(1, 'First name is required').max(100),
  playerLastName: z.string().min(1, 'Last name is required').max(100),
});

export type AddPlayerFormData = z.infer<typeof addPlayerSchema>;
