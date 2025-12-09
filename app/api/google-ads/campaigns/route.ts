export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCampaignMetrics } from '@/../lib/google-ads'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const metrics = await getCampaignMetrics(startDate, endDate)
    
    return NextResponse.json(metrics)
  } catch (error: any) {
    console.error('Error in Google Ads API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaign metrics' },
      { status: 500 }
    )
  }
}
