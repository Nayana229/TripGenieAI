import { NextResponse } from 'next/server';
import { refineItineraryWithChat } from '@/src/server/geminiService';
import { chatRequestSchema, extractApiError } from '@/src/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
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
    const result = await refineItineraryWithChat({
      tripInput: parsed.data.tripInput,
      currentItinerary: parsed.data.currentItinerary as unknown as Parameters<
        typeof refineItineraryWithChat
      >[0]['currentItinerary'],
      history: parsed.data.history,
      userMessage: parsed.data.message,
    });
    return NextResponse.json(result);
  } catch (error) {
    const err = extractApiError(error);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
