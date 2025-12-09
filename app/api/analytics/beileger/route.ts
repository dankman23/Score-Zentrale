import { NextRequest, NextResponse } from 'next/server';
import { fetchBeilegerMetrics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '30daysAgo';
    const endDate = searchParams.get('endDate') || 'today';

    const beilegerData = await fetchBeilegerMetrics(startDate, endDate);

    return NextResponse.json(beilegerData);
  } catch (error: any) {
    console.error('Beileger metrics API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Beileger metrics' },
      { status: 500 }
    );
  }
}
