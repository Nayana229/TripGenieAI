import { NextResponse } from 'next/server';
import {
  FALLBACK_GEMINI_MODELS,
  getGeminiApiKey,
  resolveModelChain,
} from '@/src/server/geminiService';
import {
  ACCOMMODATION_OPTIONS,
  SUPPORTED_CURRENCIES,
  TRAVEL_PERSONALITIES,
} from '@/src/types/travel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const modelChain = resolveModelChain();
  return NextResponse.json({
    status: 'ok',
    app: 'TripGenie AI',
    framework: 'Next.js App Router',
    geminiConfigured: Boolean(getGeminiApiKey()),
    primaryModel: modelChain[0],
    fallbackModels: FALLBACK_GEMINI_MODELS,
    options: {
      currencies: SUPPORTED_CURRENCIES,
      personalities: TRAVEL_PERSONALITIES,
      accommodations: ACCOMMODATION_OPTIONS,
    },
  });
}
