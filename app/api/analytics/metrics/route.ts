export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchAnalyticsMetrics } from '../../../../lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '30daysAgo'
    const endDate = searchParams.get('endDate') || 'today'

    const metrics = await fetchAnalyticsMetrics(startDate, endDate)
    
    return NextResponse.json(metrics)
  } catch (error: any) {
    console.error('Error in metrics API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics metrics' },
      { status: 500 }
    )
  }
}