import { createHash } from 'node:crypto';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type GenerateContentResponse,
  type Schema,
} from '@google/genai';
import type { ItineraryData, TripInput } from '../types/travel';
import { modularTravelAdapters } from './travelProviders';

export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODELS = ['gemini-3.1-flash-lite'] as const;

// Non-deprecated fast/lite generateContent candidates ordered by preference
// when verifying or extending against ai.models.list().
const PREFERRED_VERIFIED_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-pro-vision',
  'gemini-1.0-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
  'gemini-2.0-flash-exp',
]);

// Paid-tier-only models that must not be auto-selected on free keys unless explicitly configured.
const PAID_ONLY_MODELS = new Set([
  'gemini-4-carbon',
  'gemini-4-neon',
  'gemini-4-argon',
  'gemini-3-pro-image',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-lite-image',
  'gemini-omni-1.2-flash',
  'genie-4',
  'lyria-3-clip-preview',
  'lyria-3-pro-preview',
]);

const NON_TEXT_MODEL_RE =
  /(embed|imagen|veo|lyria|tts|transcribe|live|audio|image|genie|decision|robotics|computer-use|aqa|gemma|bisect|learnlm)/i;

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_MODELS_PER_REQUEST = 3;

interface CachedModelsEntry {
  keyFingerprint: string;
  fetchedAt: number;
  generateContentModels: string[];
}

let cachedModels: CachedModelsEntry | null = null;

export interface ModelAttemptRecord {
  model: string;
  status?: number;
  code?: string;
  message: string;
  durationMs: number;
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export class GeminiAggregateError extends Error {
  readonly attempts: ModelAttemptRecord[];
  readonly availableModels?: string[];
  readonly lastError: unknown;

  constructor(
    message: string,
    attempts: ModelAttemptRecord[],
    lastError: unknown,
    availableModels?: string[]
  ) {
    super(message);
    this.name = 'GeminiAggregateError';
    this.attempts = attempts;
    this.lastError = lastError;
    this.availableModels = availableModels;
  }
}

export function getGeminiApiKeyDetails(): {
  apiKey: string | null;
  envVarName: string | null;
} {
  const candidates: Array<[string, string | undefined]> = [
    ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
    ['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY],
    ['GOOGLE_GENERATIVE_AI_API_KEY', process.env.GOOGLE_GENERATIVE_AI_API_KEY],
  ];

  for (const [envVarName, raw] of candidates) {
    if (!raw) continue;
    const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
    if (
      cleaned &&
      cleaned !== 'MY_GEMINI_API_KEY' &&
      cleaned !== 'YOUR_GEMINI_API_KEY'
    ) {
      return { apiKey: cleaned, envVarName };
    }
  }
  return { apiKey: null, envVarName: null };
}

export function getGeminiApiKey(): string | null {
  return getGeminiApiKeyDetails().apiKey;
}

function getKeyFingerprint(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

function createGeminiClient(): { ai: GoogleGenAI; apiKey: string } {
  const { apiKey } = getGeminiApiKeyDetails();
  if (!apiKey) {
    throw new GeminiConfigError('GEMINI_API_KEY is not configured on the server.');
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return { ai, apiKey };
}

function normalizeModelId(rawName: string | undefined): string {
  if (!rawName) return '';
  return rawName.trim().replace(/^models\//, '');
}

export function isDeprecatedModelId(modelId: string): boolean {
  const normalized = normalizeModelId(modelId).toLowerCase();
  if (!normalized) return true;
  if (DEPRECATED_MODELS.has(normalized)) return true;
  if (
    normalized.startsWith('gemini-1.') ||
    normalized.startsWith('gemini-2.0-') ||
    normalized === 'gemini-pro'
  ) {
    return true;
  }
  return false;
}

function isCandidateTextModel(modelId: string, allowExplicitEnvModel?: string): boolean {
  const normalized = normalizeModelId(modelId);
  if (!normalized) return false;
  if (isDeprecatedModelId(normalized)) return false;
  if (NON_TEXT_MODEL_RE.test(normalized)) return false;
  if (PAID_ONLY_MODELS.has(normalized) && normalized !== allowExplicitEnvModel) {
    return false;
  }
  return normalized.startsWith('gemini-');
}

export function resolveModelChain(
  dayCount = 3,
  availableGenerateContentModels?: string[]
): string[] {
  const rawEnvModel = normalizeModelId(process.env.GEMINI_MODEL);
  const envModel = rawEnvModel && !isDeprecatedModelId(rawEnvModel) ? rawEnvModel : '';

  const baseDefaults =
    dayCount >= 6
      ? ['gemini-3.1-flash-lite', PRIMARY_GEMINI_MODEL]
      : [PRIMARY_GEMINI_MODEL, ...FALLBACK_GEMINI_MODELS];

  if (!availableGenerateContentModels || availableGenerateContentModels.length === 0) {
    return Array.from(new Set([...(envModel ? [envModel] : []), ...baseDefaults]))
      .filter((id) => isCandidateTextModel(id, envModel))
      .slice(0, MAX_MODELS_PER_REQUEST);
  }

  const desiredOrder = Array.from(
    new Set([
      ...(envModel ? [envModel] : []),
      ...baseDefaults,
      ...PREFERRED_VERIFIED_MODELS,
    ])
  ).filter((id) => isCandidateTextModel(id, envModel));

  const availableSet = new Set(availableGenerateContentModels.map((m) => normalizeModelId(m)));
  const verifiedPreferred = desiredOrder.filter((id) => availableSet.has(id));

  // Add any remaining verified non-deprecated Gemini flash/lite text models from models.list()
  const extraVerified = availableGenerateContentModels
    .map((m) => normalizeModelId(m))
    .filter(
      (id) =>
        !verifiedPreferred.includes(id) &&
        isCandidateTextModel(id, envModel) &&
        (id.includes('flash') || id.includes('hydrogen') || id.includes('lite'))
    );

  const combined = [...verifiedPreferred, ...extraVerified];

  if (combined.length > 0) {
    return combined.slice(0, MAX_MODELS_PER_REQUEST);
  }

  // Last-resort verified text models if none matched flash/hydrogen naming
  const anyVerifiedGemini = availableGenerateContentModels
    .map((m) => normalizeModelId(m))
    .filter((id) => isCandidateTextModel(id, envModel));

  if (anyVerifiedGemini.length > 0) {
    return anyVerifiedGemini.slice(0, MAX_MODELS_PER_REQUEST);
  }

  return baseDefaults.slice(0, MAX_MODELS_PER_REQUEST);
}

export async function listVerifiedGenerateContentModels(
  ai: GoogleGenAI,
  apiKey: string,
  options?: { bypassCache?: boolean; timeoutMs?: number }
): Promise<string[]> {
  const fingerprint = getKeyFingerprint(apiKey);
  if (
    !options?.bypassCache &&
    cachedModels &&
    cachedModels.keyFingerprint === fingerprint &&
    Date.now() - cachedModels.fetchedAt < MODEL_CACHE_TTL_MS
  ) {
    return cachedModels.generateContentModels;
  }

  const timeoutMs = options?.timeoutMs ?? 2_800;
  const fetchList = async (): Promise<string[]> => {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    const supported: string[] = [];
    for await (const model of pager) {
      const id = normalizeModelId(model.name);
      if (!id) continue;
      const actions = model.supportedActions;
      const supportsGenerate =
        Array.isArray(actions) &&
        actions.some((a) => a === 'generateContent' || a === 'generateText');
      if (supportsGenerate && !isDeprecatedModelId(id)) {
        supported.push(id);
      }
    }
    return Array.from(new Set(supported));
  };

  const models = await withTimeout(fetchList(), timeoutMs, 'Gemini models.list');
  cachedModels = {
    keyFingerprint: fingerprint,
    fetchedAt: Date.now(),
    generateContentModels: models,
  };
  return models;
}

export async function verifyGeminiSetup(): Promise<{
  geminiConfigured: boolean;
  keyEnvVar: string | null;
  keyStatus: 'valid' | 'missing' | 'invalid' | 'permission_denied' | 'quota_exceeded' | 'error';
  availableGenerateContentModels: string[];
  selectedModelChain: string[];
  errorMessage?: string;
}> {
  const { apiKey, envVarName } = getGeminiApiKeyDetails();
  if (!apiKey) {
    return {
      geminiConfigured: false,
      keyEnvVar: null,
      keyStatus: 'missing',
      availableGenerateContentModels: [],
      selectedModelChain: resolveModelChain(3),
      errorMessage:
        'GEMINI_API_KEY is not set in the server environment. Add it in Vercel Project Settings -> Environment Variables or AI Studio Settings > Secrets.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  try {
    const available = await listVerifiedGenerateContentModels(ai, apiKey, {
      bypassCache: true,
      timeoutMs: 5_000,
    });
    const selectedModelChain = resolveModelChain(3, available);
    return {
      geminiConfigured: true,
      keyEnvVar: envVarName,
      keyStatus: 'valid',
      availableGenerateContentModels: available,
      selectedModelChain,
    };
  } catch (err) {
    const parsed = inspectUpstreamError(err);
    let keyStatus: 'invalid' | 'permission_denied' | 'quota_exceeded' | 'error' = 'error';
    if (isAuthOrKeyError(err)) {
      keyStatus = parsed.status === 403 ? 'permission_denied' : 'invalid';
    } else if (parsed.status === 429) {
      keyStatus = 'quota_exceeded';
    }
    console.error('[TripGenie][Gemini] verifyGeminiSetup models.list failed:', parsed);
    return {
      geminiConfigured: true,
      keyEnvVar: envVarName,
      keyStatus,
      availableGenerateContentModels: [],
      selectedModelChain: resolveModelChain(3),
      errorMessage: parsed.message,
    };
  }
}

function parseJsonSafe<T>(rawText: string, label: string): T {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new Error(`Received an invalid JSON structure while parsing ${label}.`);
  }
}

const activitySlotSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    location: { type: Type.STRING },
    duration: { type: Type.STRING },
    estimatedCost: { type: Type.NUMBER },
  },
  required: ['title', 'description', 'location', 'duration', 'estimatedCost'],
};

const itinerarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overview: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        bestTimeTip: { type: Type.STRING },
        localTransportNote: { type: Type.STRING },
        estimationDisclaimer: { type: Type.STRING },
      },
      required: ['summary', 'bestTimeTip', 'localTransportNote', 'estimationDisclaimer'],
    },
    budgetAnalysis: {
      type: Type.OBJECT,
      properties: {
        realismStatus: {
          type: Type.STRING,
          enum: ['realistic', 'tight', 'unrealistic'],
        },
        isRealistic: { type: Type.BOOLEAN },
        warningMessage: { type: Type.STRING },
        estimatedTotal: { type: Type.NUMBER },
        userBudget: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        priceDisclaimer: { type: Type.STRING },
        breakdown: {
          type: Type.OBJECT,
          properties: {
            transportation: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                percentage: { type: Type.NUMBER },
                note: { type: Type.STRING },
              },
              required: ['amount', 'percentage', 'note'],
            },
            accommodation: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                percentage: { type: Type.NUMBER },
                note: { type: Type.STRING },
              },
              required: ['amount', 'percentage', 'note'],
            },
            food: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                percentage: { type: Type.NUMBER },
                note: { type: Type.STRING },
              },
              required: ['amount', 'percentage', 'note'],
            },
            activities: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                percentage: { type: Type.NUMBER },
                note: { type: Type.STRING },
              },
              required: ['amount', 'percentage', 'note'],
            },
          },
          required: ['transportation', 'accommodation', 'food', 'activities'],
        },
        savingTips: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'realismStatus',
        'isRealistic',
        'warningMessage',
        'estimatedTotal',
        'userBudget',
        'currency',
        'priceDisclaimer',
        'breakdown',
        'savingTips',
      ],
    },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayNumber: { type: Type.INTEGER },
          date: { type: Type.STRING },
          theme: { type: Type.STRING },
          morning: activitySlotSchema,
          afternoon: activitySlotSchema,
          evening: activitySlotSchema,
          recommendedAttractions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          foodRecommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                cuisine: { type: Type.STRING },
                dishToTry: { type: Type.STRING },
                priceNote: { type: Type.STRING },
              },
              required: ['name', 'cuisine', 'dishToTry', 'priceNote'],
            },
          },
          estimatedDayExpense: { type: Type.NUMBER },
          travelSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'dayNumber',
          'date',
          'theme',
          'morning',
          'afternoon',
          'evening',
          'recommendedAttractions',
          'foodRecommendations',
          'estimatedDayExpense',
          'travelSuggestions',
        ],
      },
    },
  },
  required: ['overview', 'budgetAnalysis', 'days'],
};

const chatResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    shouldUpdateItinerary: { type: Type.BOOLEAN },
    updatedItinerary: itinerarySchema,
  },
  required: ['reply', 'shouldUpdateItinerary'],
};

function inspectUpstreamError(error: unknown): {
  status?: number;
  code?: string;
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown Gemini error');
  let status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  if (status !== undefined && Number.isNaN(status)) status = undefined;

  let code: string | undefined;
  let message = raw;

  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
        message?: string;
        status?: string;
      };
      if (parsed.error) {
        if (!status && parsed.error.code) status = Number(parsed.error.code);
        code = parsed.error.status;
        if (parsed.error.message) message = parsed.error.message;
      } else if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      // Keep original message if not JSON
    }
  }

  return { status, code, message };
}

function isAuthOrKeyError(error: unknown): boolean {
  const info = inspectUpstreamError(error);
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return (
    info.status === 401 ||
    info.status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('api key expired') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated')
  );
}

function isTimeoutError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('504')
  );
}

function isTransientError(error: unknown): boolean {
  const info = inspectUpstreamError(error);
  if (info.status === 429 || info.status === 502 || info.status === 503 || info.status === 504) {
    return true;
  }
  if (isTimeoutError(error)) return true;
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch failed')
  );
}

function isModelFallbackEligible(error: unknown): boolean {
  if (isAuthOrKeyError(error)) return false;
  if (isTransientError(error)) return true;
  const info = inspectUpstreamError(error);
  if (info.status === 404 || info.status === 400) return true;
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return (
    lower.includes('not_found') ||
    lower.includes('not found') ||
    lower.includes('not supported') ||
    lower.includes('invalid_argument')
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildThinkingConfig(model: string): { thinkingConfig?: { thinkingLevel: ThinkingLevel } } {
  // Only Gemini 4 primary model gets explicit LOW thinking; gemini-3.1-flash-lite defaults to MINIMAL,
  // and non-Gemini-3/4 models reject thinkingLevel with 400.
  if (model === 'gemini-4-hydrogen') {
    return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
  }
  return {};
}

async function generateWithModelFallback(
  executeForModel: (ai: GoogleGenAI, model: string) => Promise<GenerateContentResponse>,
  dayCount = 3
): Promise<GenerateContentResponse> {
  const { ai, apiKey } = createGeminiClient();

  let availableModels: string[] | undefined;
  try {
    availableModels = await listVerifiedGenerateContentModels(ai, apiKey);
    if (availableModels.length > 0) {
      console.info(
        `[TripGenie][Gemini] Verified generateContent models (${availableModels.length}): ${availableModels.join(', ')}`
      );
    }
  } catch (listErr) {
    // Fail fast if the API key itself is invalid or lacks permission.
    if (isAuthOrKeyError(listErr)) {
      const info = inspectUpstreamError(listErr);
      console.error('[TripGenie][Gemini] models.list auth failure:', info);
      throw listErr;
    }
    const info = inspectUpstreamError(listErr);
    console.warn(
      `[TripGenie][Gemini] models.list skipped (${info.message}); falling back to default model chain.`
    );
  }

  const models = resolveModelChain(dayCount, availableModels);
  const deadlineAt = Date.now() + 18_000;
  const attempts: ModelAttemptRecord[] = [];
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const hasNext = i < models.length - 1;
    const remaining = deadlineAt - Date.now();
    if (remaining <= 1_200) {
      break;
    }

    // Fail over cleanly (up to 5.5s on primary when fallback exists) so we don't stall on overloaded models.
    const callTimeoutMs = hasNext
      ? Math.min(5_500, remaining - 3_000)
      : Math.max(3_500, remaining - 250);

    const start = Date.now();
    try {
      const response = await withTimeout(
        executeForModel(ai, model),
        callTimeoutMs,
        `Gemini (${model})`
      );
      return response;
    } catch (error) {
      const durationMs = Date.now() - start;
      const info = inspectUpstreamError(error);
      attempts.push({
        model,
        status: info.status,
        code: info.code,
        message: info.message,
        durationMs,
      });
      lastError = error;

      console.error(
        `[TripGenie][Gemini] Model "${model}" failed in ${durationMs}ms (status=${info.status ?? 'unknown'}, code=${info.code ?? 'none'}): ${info.message}`
      );

      // Auth/key errors cannot be solved by trying another model — fail immediately.
      if (isAuthOrKeyError(error)) {
        throw error;
      }

      // Single fast retry ONLY when there is just 1 model in the chain and it failed quickly with a transient error.
      if (!hasNext && models.length === 1 && durationMs < 1_200 && isTransientError(error)) {
        const retryRemaining = deadlineAt - Date.now();
        if (retryRemaining > 3_000) {
          await new Promise((r) => setTimeout(r, 350));
          const retryStart = Date.now();
          try {
            return await withTimeout(
              executeForModel(ai, model),
              Math.max(2_500, deadlineAt - Date.now() - 250),
              `Gemini (${model} retry)`
            );
          } catch (retryErr) {
            const retryInfo = inspectUpstreamError(retryErr);
            attempts.push({
              model: `${model} (retry)`,
              status: retryInfo.status,
              code: retryInfo.code,
              message: retryInfo.message,
              durationMs: Date.now() - retryStart,
            });
            lastError = retryErr;
          }
        }
      }

      if (!hasNext || !isModelFallbackEligible(error)) {
        break;
      }
    }
  }

  const summary = attempts
    .map((a) => `${a.model}: ${a.status ?? 'ERR'} ${a.message}`)
    .join(' | ');
  throw new GeminiAggregateError(
    summary || 'All verified Gemini models failed.',
    attempts,
    lastError,
    availableModels
  );
}

export function computeTripDays(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const clamped = Math.max(1, Math.min(14, diffDays));
  const dates: string[] = [];
  for (let i = 0; i < clamped; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function generateStructuredItinerary(input: TripInput): Promise<ItineraryData> {
  const dates = computeTripDays(input.startDate, input.endDate);

  const [flightAdvisory, lodgingAdvisory, weatherAdvisory] = await Promise.all([
    modularTravelAdapters.flights.getPlanningAdvisory(input),
    modularTravelAdapters.accommodation.getPlanningAdvisory(input),
    modularTravelAdapters.weather.getSeasonalAdvisory(input.destination, input.startDate),
  ]);

  const systemInstruction = `You are TripGenie AI, an expert senior travel architect.
Create deeply realistic, geographically coherent, day-by-day travel itineraries tailored to the traveller's starting location, destination, group size, total budget, currency, travel personality, accommodation preference, and interests.

STRICT ENGINEERING & HONESTY RULES:
1. NEVER invent or claim live hotel room availability, real-time flight fares, live train schedules, or live weather forecasts.
2. Clearly label all costs as ESTIMATED planning ranges in the requested currency (${input.currency}).
3. Perform an honest budget feasibility audit comparing totalBudget (${input.totalBudget} ${input.currency}) against realistic costs for ${input.travellers} traveller(s) traveling from ${input.startLocation} to ${input.destination} for ${dates.length} day(s) with "${input.accommodation}" accommodation and "${input.personality}" style.
   - If the budget is clearly too low to cover typical transit, lodging, food, and activities for ${input.travellers} people over ${dates.length} days, set realismStatus to "unrealistic", isRealistic to false, and provide a constructive, specific warningMessage explaining why and how much is typically needed or how to adjust.
   - If feasible only with careful compromises, set realismStatus to "tight", isRealistic to true, and explain the trade-offs in warningMessage.
   - Otherwise set realismStatus to "realistic", isRealistic to true, and set warningMessage to a brief confirmation note.
4. Keep budget breakdown percentages summing to 100 and breakdown amounts summing to estimatedTotal.
5. Generate exactly ${dates.length} day entries matching these exact dates: ${dates.join(', ')}.
6. Every activity must make geographic sense for ${input.destination} so travellers aren't zig-zagging needlessly across the region.
7. Keep prose crisp and practical (1-2 concise sentences per activity description, 2-3 recommended attractions per day, 2 food recommendations per day, 2 travel suggestions per day) for fast, scannable output.`;

  const prompt = `Plan a personalized trip with these parameters:
- Starting Location: ${input.startLocation}
- Destination: ${input.destination}
- Dates: ${input.startDate} to ${input.endDate} (${dates.length} days)
- Travellers: ${input.travellers}
- Total Budget: ${input.totalBudget} ${input.currency}
- Travel Personality: ${input.personality}
- Accommodation Preference: ${input.accommodation}
- Specific Preferences: ${input.preferences.length > 0 ? input.preferences.join(', ') : 'Balanced cultural highlights and local food'}

Context notes to incorporate into disclaimers:
- ${flightAdvisory.advisory}
- ${lodgingAdvisory.advisory}
- ${weatherAdvisory.advisory}`;

  const response = await generateWithModelFallback(
    (ai, model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: itinerarySchema,
          ...buildThinkingConfig(model),
        },
      }),
    dates.length
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty itinerary response.');
  }

  const parsed = parseJsonSafe<ItineraryData>(rawText, 'itinerary');
  parsed.budgetAnalysis.userBudget = input.totalBudget;
  parsed.budgetAnalysis.currency = input.currency;
  return parsed;
}

export async function refineItineraryWithChat(params: {
  tripInput: TripInput;
  currentItinerary: ItineraryData;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
}): Promise<{
  reply: string;
  shouldUpdateItinerary: boolean;
  updatedItinerary?: ItineraryData;
}> {
  const systemInstruction = `You are TripGenie AI's conversational itinerary assistant.
You help travellers ask questions about their trip AND modify their structured itinerary on request (e.g., swapping activities, adjusting budget/pace, adding dietary-friendly restaurants, reordering days).

RULES:
1. Never fabricate live flight prices, live hotel availability, or live weather forecasts. Always clarify that any cost numbers are estimated planning figures.
2. If the user is asking a question or seeking advice without requesting a change to the itinerary, set shouldUpdateItinerary to false and omit updatedItinerary.
3. If the user asks to modify, swap, add, remove, or optimize any day, meal, activity, or budget item in the trip, set shouldUpdateItinerary to true and return the complete updated itinerary in updatedItinerary preserving all unaffected days and keeping budgetAnalysis consistent in ${params.tripInput.currency}.`;

  const conversationSnippet = params.history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Traveller' : 'TripGenie AI'}: ${m.content}`)
    .join('\n');

  const prompt = `Trip Parameters:
${JSON.stringify(params.tripInput)}

Current Itinerary JSON:
${JSON.stringify(params.currentItinerary)}

Recent Conversation:
${conversationSnippet || '(New conversation)'}

Latest Traveller Message:
${params.userMessage}`;

  const response = await generateWithModelFallback(
    (ai, model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: chatResponseSchema,
          ...buildThinkingConfig(model),
        },
      }),
    params.currentItinerary.days?.length ?? 3
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty chat response.');
  }

  const parsed = parseJsonSafe<{
    reply: string;
    shouldUpdateItinerary: boolean;
    updatedItinerary?: ItineraryData;
  }>(rawText, 'chat response');

  if (parsed.shouldUpdateItinerary && parsed.updatedItinerary) {
    parsed.updatedItinerary.budgetAnalysis.userBudget = params.tripInput.totalBudget;
    parsed.updatedItinerary.budgetAnalysis.currency = params.tripInput.currency;
  }

  return parsed;
}
