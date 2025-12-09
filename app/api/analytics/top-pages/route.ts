export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchTopPages } from '@/../lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '30daysAgo'
    const endDate = searchParams.get('endDate') || 'today'
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const pages = await fetchTopPages(startDate, endDate, limit)
    
    return NextResponse.json(pages)
  } catch (error: any) {
    console.error('Error in top pages API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch top pages' },
      { status: 500 }
    )
  }
}