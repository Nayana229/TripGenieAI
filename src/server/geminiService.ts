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

// Active non-deprecated text models prioritized when confirmed available by ai.models.list().
// Notice we do NOT hardcode deprecated 1.x/2.0 models or unverified models like gemini-2.5-flash;
// any additional models come strictly from live ai.models.list() discovery.
const PREFERRED_ACTIVE_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-flash',
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

// Paid-tier-only models from skill spec; excluded from automatic selection unless explicitly configured via GEMINI_MODEL.
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
const MODEL_404_TTL_MS = 15 * 60 * 1000;
const MODEL_429_COOLDOWN_MS = 30 * 1000;
const MAX_CANDIDATE_MODELS = 8;

interface CachedModelsEntry {
  keyFingerprint: string;
  fetchedAt: number;
  allModelsCount: number;
  generateContentModels: string[];
}

let cachedModels: CachedModelsEntry | null = null;
// Tracks models that returned 404 (unsupported/not found) or 429 (rate-limited) per key fingerprint.
const unavailableModelsCache = new Map<string, number>();
const rateLimitedModelsCache = new Map<string, number>();

export interface ModelAttemptRecord {
  model: string;
  attempt: number;
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

function cacheKeyForModel(fingerprint: string, model: string): string {
  return `${fingerprint}:${model}`;
}

function isModelMarked404(fingerprint: string | undefined, model: string): boolean {
  if (!fingerprint) return false;
  const key = cacheKeyForModel(fingerprint, model);
  const expiresAt = unavailableModelsCache.get(key);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    unavailableModelsCache.delete(key);
    return false;
  }
  return true;
}

function markModel404(fingerprint: string, model: string): void {
  unavailableModelsCache.set(cacheKeyForModel(fingerprint, model), Date.now() + MODEL_404_TTL_MS);
}

function isModelRateLimited(fingerprint: string | undefined, model: string): boolean {
  if (!fingerprint) return false;
  const key = cacheKeyForModel(fingerprint, model);
  const expiresAt = rateLimitedModelsCache.get(key);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    rateLimitedModelsCache.delete(key);
    return false;
  }
  return true;
}

function markModelRateLimited(fingerprint: string, model: string, cooldownMs = MODEL_429_COOLDOWN_MS): void {
  rateLimitedModelsCache.set(cacheKeyForModel(fingerprint, model), Date.now() + cooldownMs);
}

function createGeminiClient(): { ai: GoogleGenAI; apiKey: string; fingerprint: string } {
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
  return { ai, apiKey, fingerprint: getKeyFingerprint(apiKey) };
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

function scoreDiscoveredModel(modelId: string): number {
  const lower = modelId.toLowerCase();
  let score = 0;
  if (lower.startsWith('gemini-4')) score += 400;
  else if (lower.startsWith('gemini-3.5')) score += 350;
  else if (lower.startsWith('gemini-3.1')) score += 310;
  else if (lower.startsWith('gemini-3')) score += 300;
  else if (lower.startsWith('gemini-2.5')) score += 250;

  if (lower.includes('hydrogen')) score += 60;
  if (lower.includes('flash-lite') || lower.includes('lite')) score += 50;
  else if (lower.includes('flash')) score += 45;
  else if (lower.includes('pro')) score += 20;

  if (lower.includes('latest')) score += 10;
  if (lower.includes('preview') || lower.includes('exp')) score -= 5;
  return score;
}

export function resolveModelChain(
  dayCount = 3,
  availableGenerateContentModels?: string[],
  keyFingerprint?: string
): string[] {
  const rawEnvModel = normalizeModelId(process.env.GEMINI_MODEL);
  const envModel = rawEnvModel && !isDeprecatedModelId(rawEnvModel) ? rawEnvModel : '';

  const baseDefaults =
    dayCount >= 6
      ? ['gemini-3.1-flash-lite', PRIMARY_GEMINI_MODEL]
      : [PRIMARY_GEMINI_MODEL, ...FALLBACK_GEMINI_MODELS];

  const filterHealthy = (list: string[]) => {
    const not404 = list.filter((id) => !isModelMarked404(keyFingerprint, id));
    const healthyFirst = not404.filter((id) => !isModelRateLimited(keyFingerprint, id));
    const rateLimitedLater = not404.filter((id) => isModelRateLimited(keyFingerprint, id));
    return [...healthyFirst, ...rateLimitedLater];
  };

  if (!availableGenerateContentModels || availableGenerateContentModels.length === 0) {
    const fallbackList = Array.from(new Set([...(envModel ? [envModel] : []), ...baseDefaults]))
      .filter((id) => isCandidateTextModel(id, envModel));
    const healthy = filterHealthy(fallbackList);
    return (healthy.length > 0 ? healthy : baseDefaults).slice(0, MAX_CANDIDATE_MODELS);
  }

  const availableSet = new Set(availableGenerateContentModels.map((m) => normalizeModelId(m)));
  const desiredPreferred = Array.from(
    new Set([
      ...(envModel ? [envModel] : []),
      ...baseDefaults,
      ...PREFERRED_ACTIVE_MODELS,
    ])
  ).filter((id) => isCandidateTextModel(id, envModel) && availableSet.has(id));

  const extraDiscovered = availableGenerateContentModels
    .map((m) => normalizeModelId(m))
    .filter((id) => !desiredPreferred.includes(id) && isCandidateTextModel(id, envModel))
    .sort((a, b) => scoreDiscoveredModel(b) - scoreDiscoveredModel(a));

  const combined = Array.from(new Set([...desiredPreferred, ...extraDiscovered]));
  const healthy = filterHealthy(combined);
  if (healthy.length > 0) {
    return healthy.slice(0, MAX_CANDIDATE_MODELS);
  }

  return Array.from(new Set([...(envModel ? [envModel] : []), ...baseDefaults])).slice(
    0,
    MAX_CANDIDATE_MODELS
  );
}

export async function listVerifiedGenerateContentModels(
  ai: GoogleGenAI,
  apiKey: string,
  options?: { bypassCache?: boolean; timeoutMs?: number }
): Promise<{ models: string[]; allModelsCount: number }> {
  const fingerprint = getKeyFingerprint(apiKey);
  if (
    !options?.bypassCache &&
    cachedModels &&
    cachedModels.keyFingerprint === fingerprint &&
    Date.now() - cachedModels.fetchedAt < MODEL_CACHE_TTL_MS
  ) {
    return {
      models: cachedModels.generateContentModels,
      allModelsCount: cachedModels.allModelsCount,
    };
  }

  const timeoutMs = options?.timeoutMs ?? 3_000;
  const fetchList = async (): Promise<{ models: string[]; allModelsCount: number }> => {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    const supported: string[] = [];
    const fallbackIfNoActions: string[] = [];
    let allModelsCount = 0;

    for await (const model of pager) {
      allModelsCount++;
      const id = normalizeModelId(model.name);
      if (!id || isDeprecatedModelId(id)) continue;

      const actions = model.supportedActions;
      if (Array.isArray(actions)) {
        if (actions.some((a) => a === 'generateContent' || a === 'generateText')) {
          supported.push(id);
        }
      } else {
        fallbackIfNoActions.push(id);
      }
    }

    const models = Array.from(
      new Set(supported.length > 0 ? supported : fallbackIfNoActions)
    );
    return { models, allModelsCount };
  };

  const result = await withTimeout(fetchList(), timeoutMs, 'Gemini models.list');
  cachedModels = {
    keyFingerprint: fingerprint,
    fetchedAt: Date.now(),
    allModelsCount: result.allModelsCount,
    generateContentModels: result.models,
  };
  return result;
}

export async function verifyGeminiSetup(): Promise<{
  geminiConfigured: boolean;
  keyEnvVar: string | null;
  keyStatus: 'valid' | 'missing' | 'invalid' | 'permission_denied' | 'quota_exceeded' | 'error';
  allListedModelsCount?: number;
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

  const fingerprint = getKeyFingerprint(apiKey);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  try {
    const { models, allModelsCount } = await listVerifiedGenerateContentModels(ai, apiKey, {
      bypassCache: true,
      timeoutMs: 5_000,
    });
    const selectedModelChain = resolveModelChain(3, models, fingerprint);
    return {
      geminiConfigured: true,
      keyEnvVar: envVarName,
      keyStatus: 'valid',
      allListedModelsCount: allModelsCount,
      availableGenerateContentModels: models,
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
      selectedModelChain: resolveModelChain(3, undefined, fingerprint),
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
      // Keep raw message
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

function is404ModelError(error: unknown): boolean {
  const info = inspectUpstreamError(error);
  if (info.status === 404) return true;
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return (
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('not supported for generatecontent')
  );
}

function is429RateLimitError(error: unknown): boolean {
  const info = inspectUpstreamError(error);
  if (info.status === 429) return true;
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit');
}

function is503UnavailableError(error: unknown): boolean {
  const info = inspectUpstreamError(error);
  if (info.status === 503) return true;
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return (
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('503')
  );
}

function isTransientNetworkError(error: unknown): boolean {
  const info = inspectUpstreamError(error);
  if (info.status === 502 || info.status === 504) return true;
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return (
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch failed')
  );
}

function isModelFallbackEligible(error: unknown): boolean {
  if (isAuthOrKeyError(error)) return false;
  if (
    is404ModelError(error) ||
    is429RateLimitError(error) ||
    is503UnavailableError(error) ||
    isTimeoutError(error) ||
    isTransientNetworkError(error)
  ) {
    return true;
  }
  const info = inspectUpstreamError(error);
  if (info.status === 400) return true;
  const lower = `${info.code ?? ''} ${info.message}`.toLowerCase();
  return lower.includes('invalid_argument') || lower.includes('not supported');
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
  // Only pass ThinkingLevel.LOW to gemini-4-hydrogen; gemini-3.1-flash-lite defaults to MINIMAL,
  // and non-Gemini-3/4 models reject thinkingConfig with 400.
  if (model === 'gemini-4-hydrogen') {
    return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
  }
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithModelFallback(
  executeForModel: (ai: GoogleGenAI, model: string) => Promise<GenerateContentResponse>,
  dayCount = 3
): Promise<GenerateContentResponse> {
  const { ai, apiKey, fingerprint } = createGeminiClient();

  let availableModels: string[] | undefined;
  try {
    const listed = await listVerifiedGenerateContentModels(ai, apiKey);
    availableModels = listed.models;
    if (availableModels.length > 0) {
      console.info(
        `[TripGenie][Gemini] Discovered ${availableModels.length} generateContent models (from ${listed.allModelsCount} total): ${availableModels.join(', ')}`
      );
    }
  } catch (listErr) {
    if (isAuthOrKeyError(listErr)) {
      const info = inspectUpstreamError(listErr);
      console.error('[TripGenie][Gemini] models.list auth failure:', info);
      throw listErr;
    }
    const info = inspectUpstreamError(listErr);
    console.warn(
      `[TripGenie][Gemini] models.list warning (${info.message}); using default active model chain.`
    );
  }

  const models = resolveModelChain(dayCount, availableModels, fingerprint);
  const deadlineAt = Date.now() + 22_000;
  const attempts: ModelAttemptRecord[] = [];
  const rateLimitedModelsToRetryLater: string[] = [];
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const hasNext = i < models.length - 1;
    const remaining = deadlineAt - Date.now();
    if (remaining <= 1_500) {
      break;
    }

    // Retry up to 2 times with exponential backoff on 503 Unavailable (only if it fails fast, not timeout).
    const max503Retries = 2;
    for (let retryIdx = 0; retryIdx <= max503Retries; retryIdx++) {
      const attemptRemaining = deadlineAt - Date.now();
      if (attemptRemaining <= 1_200) break;

      const perCallMs = hasNext
        ? Math.min(7_500, attemptRemaining - 2_000)
        : Math.max(3_500, attemptRemaining - 250);

      const start = Date.now();
      try {
        return await withTimeout(
          executeForModel(ai, model),
          perCallMs,
          `Gemini (${model})`
        );
      } catch (error) {
        const durationMs = Date.now() - start;
        const info = inspectUpstreamError(error);
        const status =
          info.status ??
          (is404ModelError(error)
            ? 404
            : is429RateLimitError(error)
              ? 429
              : is503UnavailableError(error)
                ? 503
                : isTimeoutError(error)
                  ? 504
                  : undefined);

        attempts.push({
          model,
          attempt: retryIdx + 1,
          status,
          code: info.code,
          message: info.message,
          durationMs,
        });
        lastError = error;

        console.error(
          `[TripGenie][Gemini] Model "${model}" (attempt ${retryIdx + 1}) failed in ${durationMs}ms (status=${status ?? 'unknown'}, code=${info.code ?? 'none'}): ${info.message}`
        );

        // Auth/key errors cannot be fixed by retrying or switching models.
        if (isAuthOrKeyError(error)) {
          throw error;
        }

        // 404: Cache as unavailable for this key and move immediately to next supported model.
        if (status === 404 || is404ModelError(error)) {
          markModel404(fingerprint, model);
          break;
        }

        // 429: Put model in short cooldown and move immediately to another model with separate quota.
        if (status === 429 || is429RateLimitError(error)) {
          markModelRateLimited(fingerprint, model);
          rateLimitedModelsToRetryLater.push(model);
          break;
        }

        // 503: Retry this model with exponential backoff + jitter if failure was quick and budget remains.
        if (
          (status === 503 || is503UnavailableError(error)) &&
          retryIdx < max503Retries &&
          !isTimeoutError(error) &&
          durationMs < 4_000
        ) {
          const baseDelay = 450 * Math.pow(2, retryIdx);
          const jitter = Math.floor(Math.random() * 180);
          const backoffMs = Math.min(baseDelay + jitter, Math.max(0, deadlineAt - Date.now() - 2_500));
          if (backoffMs >= 200) {
            await sleep(backoffMs);
            continue;
          }
        }

        // Otherwise stop retrying this model; fall back if eligible.
        if (!isModelFallbackEligible(error)) {
          throw new GeminiAggregateError(
            `${model}: ${status ?? 'ERR'} ${info.message}`,
            attempts,
            error,
            availableModels
          );
        }
        break;
      }
    }
  }

  // If every model returned 429 and time permits, perform one brief rate-limit backoff retry on the first rate-limited model.
  if (
    rateLimitedModelsToRetryLater.length > 0 &&
    attempts.every((a) => a.status === 429) &&
    deadlineAt - Date.now() > 4_000
  ) {
    const retryModel = rateLimitedModelsToRetryLater[0];
    await sleep(1_200);
    const start = Date.now();
    try {
      return await withTimeout(
        executeForModel(ai, retryModel),
        Math.max(3_000, deadlineAt - Date.now() - 250),
        `Gemini (${retryModel} rate-limit retry)`
      );
    } catch (retryErr) {
      const info = inspectUpstreamError(retryErr);
      attempts.push({
        model: retryModel,
        attempt: 2,
        status: info.status ?? 429,
        code: info.code,
        message: info.message,
        durationMs: Date.now() - start,
      });
      lastError = retryErr;
    }
  }

  const summary = attempts
    .map((a) => `${a.model}#${a.attempt}: ${a.status ?? 'ERR'} ${a.message}`)
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
