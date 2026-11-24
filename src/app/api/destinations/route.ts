import { NextResponse } from 'next/server';
import { DESTINATION_GUIDES } from '@/src/data/destinations';

export async function GET() {
  return NextResponse.json({ destinations: DESTINATION_GUIDES });
}
