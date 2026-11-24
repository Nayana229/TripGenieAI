import { NextResponse } from 'next/server';
import {
  ACCOMMODATION_OPTIONS,
  SUPPORTED_CURRENCIES,
  TRAVEL_PERSONALITIES,
} from '@/src/types/travel';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'TripGenie AI',
    framework: 'Next.js App Router',
    options: {
      currencies: SUPPORTED_CURRENCIES,
      personalities: TRAVEL_PERSONALITIES,
      accommodations: ACCOMMODATION_OPTIONS,
    },
  });
}
