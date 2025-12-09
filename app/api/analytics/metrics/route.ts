export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchAnalyticsMetrics } from '@/../lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '30daysAgo'
    const endDate = searchParams.get('endDate') || 'today'

    const metrics = await fetchAnalyticsMetrics(startDate, endDate)
    
    return NextResponse.json(metrics)
  } catch (error: any) {
    console.error('Error in metrics API route:', error)
    
    // Return empty/default metrics instead of crashing
    return NextResponse.json({
      sessions: 0,
      users: 0,
      pageViews: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      conversions: 0,
      revenue: 0,
      error: error.message || 'Failed to fetch analytics metrics'
    })
  }
}