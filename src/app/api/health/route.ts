import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/src/server/geminiService';
import {
  ACCOMMODATION_OPTIONS,
  SUPPORTED_CURRENCIES,
  TRAVEL_PERSONALITIES,
} from '@/src/types/travel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'TripGenie AI',
    framework: 'Next.js App Router',
    geminiConfigured: Boolean(getGeminiApiKey()),
    options: {
      currencies: SUPPORTED_CURRENCIES,
      personalities: TRAVEL_PERSONALITIES,
      accommodations: ACCOMMODATION_OPTIONS,
    },
  });
}
