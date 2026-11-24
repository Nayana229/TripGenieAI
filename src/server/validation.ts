import { z } from 'zod';
import {
  BLUEPRINT_LIMITS,
  SUPPORTED_CURRENCIES,
  TRAVEL_PERSONALITIES,
} from '../types/travel';
import {
  GeminiAggregateError,
  GeminiConfigError,
  type ModelAttemptRecord,
} from './geminiService';

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

function extractReadableMessage(error: unknown): {
  rawMessage: string;
  friendlyMessage: string;
  statusCode?: number;
} {
  const rawMessage =
    error instanceof Error ? error.message : String(error || 'Unexpected server error.');
  let statusCode =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  if (statusCode !== undefined && Number.isNaN(statusCode)) statusCode = undefined;

  let friendlyMessage = rawMessage;
  const trimmed = rawMessage.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
        message?: string;
      };
      if (parsed.error?.code && !statusCode) {
        statusCode = Number(parsed.error.code);
      }
      friendlyMessage = parsed.error?.message || parsed.message || 'Upstream AI service error.';
    } catch {
      friendlyMessage = 'An unexpected response was received from the AI service.';
    }
  }

  return { rawMessage, friendlyMessage, statusCode };
}

function summarizeAttemptModels(attempts?: ModelAttemptRecord[]): string {
  if (!attempts || attempts.length === 0) return '';
  const uniqueModels = Array.from(new Set(attempts.map((a) => a.model)));
  return uniqueModels.join(', ');
}

function classifySingleError(
  error: unknown,
  attempts?: ModelAttemptRecord[]
): { status: number; message: string } {
  const { rawMessage, friendlyMessage, statusCode } = extractReadableMessage(error);
  const lower = `${rawMessage} ${friendlyMessage}`.toLowerCase();
  const triedModels = summarizeAttemptModels(attempts);
  const triedSuffix = triedModels ? ` (attempted: ${triedModels})` : '';

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('api key expired') ||
    statusCode === 401
  ) {
    return {
      status: 401,
      message:
        'The configured GEMINI_API_KEY is invalid or expired. Update GEMINI_API_KEY in Vercel Environment Variables (or Settings > Secrets) and redeploy.',
    };
  }

  if (lower.includes('permission_denied') || statusCode === 403) {
    return {
      status: 403,
      message:
        'Gemini API access was denied for the configured key (403). Verify Generative Language API access and billing permissions on your Google AI Studio project.',
    };
  }

  if (lower.includes('resource_exhausted') || lower.includes('429') || statusCode === 429) {
    return {
      status: 429,
      message: `Gemini API quota or rate limit exceeded (429)${triedSuffix}. Wait a moment or check your Google AI Studio quota and billing plan.`,
    };
  }

  if (
    lower.includes('not_found') ||
    lower.includes('not supported for generatecontent') ||
    statusCode === 404
  ) {
    return {
      status: 502,
      message: `The configured Gemini model was not found or does not support generateContent${triedSuffix}. Check GET /api/health?verify=1 to inspect available models for your API key.`,
    };
  }

  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    statusCode === 503
  ) {
    return {
      status: 503,
      message: `Upstream Gemini service returned 503 Unavailable${triedSuffix}: ${friendlyMessage}`,
    };
  }

  if (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('504') ||
    statusCode === 504
  ) {
    return {
      status: 504,
      message: `Gemini did not finish responding in time${triedSuffix}. Please try again—shorter trips generate fastest.`,
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('und_err_connect_timeout')
  ) {
    return {
      status: 502,
      message: `Network error reaching the Gemini API${triedSuffix}: ${friendlyMessage}`,
    };
  }

  return {
    status: statusCode && statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: friendlyMessage.startsWith('{')
      ? `Unable to generate your itinerary right now${triedSuffix}.`
      : `${friendlyMessage}${triedSuffix}`,
  };
}

export function extractApiError(error: unknown): { status: number; message: string } {
  if (error instanceof GeminiConfigError) {
    return {
      status: 503,
      message:
        'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Vercel Project Settings -> Environment Variables (or AI Studio Settings > Secrets) and redeploy.',
    };
  }

  if (error instanceof GeminiAggregateError) {
    console.error('[TripGenie][API] GeminiAggregateError:', {
      attempts: error.attempts,
      availableModelsCount: error.availableModels?.length ?? null,
    });

    const grouped = new Map<string, { status?: number; count: number }>();
    for (const a of error.attempts) {
      const prev = grouped.get(a.model);
      if (prev) {
        prev.count += 1;
        prev.status = a.status ?? prev.status;
      } else {
        grouped.set(a.model, { status: a.status, count: 1 });
      }
    }

    const base = classifySingleError(error.lastError);
    if (grouped.size > 0) {
      const attemptSummary = Array.from(grouped.entries())
        .map(([model, info]) =>
          `${model} [${info.status ?? 'ERR'}${info.count > 1 ? ` x${info.count}` : ''}]`
        )
        .join(', ');
      return {
        status: base.status,
        message: `Tried Gemini models: ${attemptSummary}. ${base.message}`,
      };
    }
    return base;
  }

  return classifySingleError(error);
}
