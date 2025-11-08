export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchPageTimeSeries } from '../../../../../lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pagePath = searchParams.get('pagePath')
    const startDate = searchParams.get('startDate') || '30daysAgo'
    const endDate = searchParams.get('endDate') || 'today'

    if (!pagePath) {
      return NextResponse.json(
        { error: 'pagePath parameter is required' },
        { status: 400 }
      )
    }

    const timeSeries = await fetchPageTimeSeries(pagePath, startDate, endDate)
    
    return NextResponse.json(timeSeries)
  } catch (error: any) {
    console.error('Error in page timeseries API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch page time series' },
      { status: 500 }
    )
  }
}