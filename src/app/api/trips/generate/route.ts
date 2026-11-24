import { NextResponse } from 'next/server';
import { generateStructuredItinerary } from '@/src/server/geminiService';
import { extractApiError, tripInputSchema } from '@/src/server/validation';

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
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
