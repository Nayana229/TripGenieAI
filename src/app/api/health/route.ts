import { NextResponse } from 'next/server';
import {
  FALLBACK_GEMINI_MODELS,
  getGeminiApiKeyDetails,
  resolveModelChain,
  verifyGeminiSetup,
} from '@/src/server/geminiService';
import {
  ACCOMMODATION_OPTIONS,
  SUPPORTED_CURRENCIES,
  TRAVEL_PERSONALITIES,
} from '@/src/types/travel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shouldVerify = url.searchParams.get('verify') === '1' || url.searchParams.get('verify') === 'true';

  if (shouldVerify) {
    const verification = await verifyGeminiSetup();
    return NextResponse.json({
      status: verification.keyStatus === 'valid' ? 'ok' : 'degraded',
      app: 'TripGenie AI',
      framework: 'Next.js App Router',
      ...verification,
      options: {
        currencies: SUPPORTED_CURRENCIES,
        personalities: TRAVEL_PERSONALITIES,
        accommodations: ACCOMMODATION_OPTIONS,
      },
    });
  }

  const { apiKey, envVarName } = getGeminiApiKeyDetails();
  const modelChain = resolveModelChain();

  return NextResponse.json({
    status: 'ok',
    app: 'TripGenie AI',
    framework: 'Next.js App Router',
    geminiConfigured: Boolean(apiKey),
    keyEnvVar: envVarName,
    primaryModel: modelChain[0],
    fallbackModels: FALLBACK_GEMINI_MODELS,
    options: {
      currencies: SUPPORTED_CURRENCIES,
      personalities: TRAVEL_PERSONALITIES,
      accommodations: ACCOMMODATION_OPTIONS,
    },
  });
}
