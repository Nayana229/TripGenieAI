import { z } from 'zod';
import {
  BLUEPRINT_LIMITS,
  SUPPORTED_CURRENCIES,
  TRAVEL_PERSONALITIES,
} from '../types/travel';

export const tripInputSchema = z
  .object({
    startLocation: z
      .string()
      .trim()
      .min(BLUEPRINT_LIMITS.LOCATION_MIN, 'Starting location must be at least 2 characters.')
      .max(BLUEPRINT_LIMITS.LOCATION_MAX, 'Starting location is too long.'),
    destination: z
      .string()
      .trim()
      .min(BLUEPRINT_LIMITS.LOCATION_MIN, 'Destination must be at least 2 characters.')
      .max(BLUEPRINT_LIMITS.LOCATION_MAX, 'Destination is too long.'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD.'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD.'),
    travellers: z
      .number()
      .int()
      .min(BLUEPRINT_LIMITS.TRAVELLERS_MIN)
      .max(BLUEPRINT_LIMITS.TRAVELLERS_MAX),
    totalBudget: z.number().positive('Total budget must be greater than 0.').max(100_000_000),
    currency: z.enum(SUPPORTED_CURRENCIES),
    personality: z.enum(TRAVEL_PERSONALITIES),
    accommodation: z
      .string()
      .trim()
      .min(BLUEPRINT_LIMITS.ACCOMMODATION_MIN)
      .max(BLUEPRINT_LIMITS.ACCOMMODATION_MAX),
    preferences: z
      .array(z.string().trim().min(1).max(BLUEPRINT_LIMITS.PREFERENCE_ITEM_MAX))
      .max(BLUEPRINT_LIMITS.PREFERENCES_MAX_ITEMS),
  })
  .refine(
    (data) => {
      const start = new Date(`${data.startDate}T00:00:00Z`);
      const end = new Date(`${data.endDate}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diffDays >= 1 && diffDays <= BLUEPRINT_LIMITS.DAYS_MAX;
    },
    {
      message: `Trip duration must be between 1 and ${BLUEPRINT_LIMITS.DAYS_MAX} days, with end date on or after start date.`,
      path: ['endDate'],
    }
  );

export const chatRequestSchema = z.object({
  tripInput: tripInputSchema,
  currentItinerary: z.object({
    overview: z.record(z.string(), z.unknown()),
    budgetAnalysis: z.record(z.string(), z.unknown()),
    days: z.array(z.record(z.string(), z.unknown())).min(1).max(BLUEPRINT_LIMITS.DAYS_MAX),
  }),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(BLUEPRINT_LIMITS.MESSAGE_MAX),
      })
    )
    .max(20),
  message: z
    .string()
    .trim()
    .min(1, 'Please enter a message.')
    .max(BLUEPRINT_LIMITS.MESSAGE_MAX, 'Message is too long.'),
});

export function extractApiError(error: unknown): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : 'Unexpected server error.';
  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('not configured')
  ) {
    return {
      status: 503,
      message:
        'AI planning service requires a valid Gemini API key in Settings > Secrets before generating itineraries.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'AI planning rate limit reached. Please wait a moment and try again.',
    };
  }
  return {
    status: 500,
    message: msg,
  };
}
