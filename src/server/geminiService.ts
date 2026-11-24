import { GoogleGenAI, Type, type Schema } from '@google/genai';
import type { ItineraryData, TripInput } from '../types/travel';
import { modularTravelAdapters } from './travelProviders';

const MODEL_NAME = 'gemini-4-hydrogen';

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export function getGeminiApiKey(): string | null {
  const candidates = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY];
  for (const raw of candidates) {
    if (!raw) continue;
    const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
    if (
      cleaned &&
      cleaned !== 'MY_GEMINI_API_KEY' &&
      cleaned !== 'YOUR_GEMINI_API_KEY'
    ) {
      return cleaned;
    }
  }
  return null;
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiConfigError('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT');
      if (!isTransient || attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
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
  const ai = createGeminiClient();
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
6. Every activity must make geographic sense for ${input.destination} so travellers aren't zig-zagging needlessly across the region.`;

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

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: itinerarySchema,
      },
    })
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty itinerary response.');
  }

  const parsed = parseJsonSafe<ItineraryData>(rawText, 'itinerary');
  // Ensure currency and userBudget match input deterministically
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
  const ai = createGeminiClient();

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

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: chatResponseSchema,
      },
    })
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
