import { z } from 'zod';

export const scoreFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Field name is required'),
  type: z.enum(['scale', 'time', 'count']),
  min: z.number(),
  max: z.number(),
  description: z.string().default(''),
  unit: z.string().optional(),
  lowerIsBetter: z.boolean().optional(),
  anchors: z.record(z.string(), z.string()).optional(),
}).refine(data => data.max > data.min, {
  message: 'Max must be greater than min',
  path: ['max'],
});

export const stationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Station name is required'),
  order: z.number().int().min(1),
  fields: z.array(scoreFieldSchema).min(1, 'At least one score field is required'),
});

export const coachCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Category name is required'),
  type: z.enum(['physical', 'soft']),
  min: z.number().default(1),
  max: z.number().default(5),
  anchors: z.record(z.string(), z.string()).optional(),
});

export const blendWeightsSchema = z.object({
  coachRating: z.number().int().min(0).max(100),
  tryoutScore: z.number().int().min(0).max(100),
}).refine(data => data.coachRating + data.tryoutScore === 100, {
  message: 'Weights must sum to 100',
});

export const templateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200, 'Name must be 200 characters or less'),
  description: z.string().default(''),
  stations: z.array(stationSchema).min(1, 'At least one station is required'),
  coachCategories: z.array(coachCategorySchema),
  blendWeights: blendWeightsSchema,
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;
