export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchMetricsTimeSeries } from '../../../lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '30daysAgo'
    const endDate = searchParams.get('endDate') || 'today'

    const timeSeries = await fetchMetricsTimeSeries(startDate, endDate)
    
    return NextResponse.json(timeSeries)
  } catch (error: any) {
    console.error('Error in metrics timeseries API route:', error)
    // Return empty array instead of crashing
    return NextResponse.json({
      data: [],
      error: error.message || 'Failed to fetch metrics time series'
    })
  }
}