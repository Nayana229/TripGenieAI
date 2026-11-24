import { NextResponse } from 'next/server';
import { generateStructuredItinerary } from '@/src/server/geminiService';
import { extractApiError, tripInputSchema } from '@/src/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const parsed = tripInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 }
    );
  }

  try {
    const itinerary = await generateStructuredItinerary(parsed.data);
    return NextResponse.json({ itinerary });
  } catch (error) {
    const err = extractApiError(error);
    console.error('[TripGenie][POST /api/trips/generate] Failed:', {
      status: err.status,
      message: err.message,
      raw: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
