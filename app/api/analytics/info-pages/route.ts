import { NextRequest, NextResponse } from 'next/server';
import { fetchInfoPages } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '30daysAgo';
    const endDate = searchParams.get('endDate') || 'today';

    const infoPages = await fetchInfoPages(startDate, endDate);

    return NextResponse.json(infoPages);
  } catch (error: any) {
    console.error('Info pages API error:', error);
    // Return empty array instead of crashing
    return NextResponse.json({
      pages: [],
      error: error.message || 'Failed to fetch info pages'
    });
  }
}
