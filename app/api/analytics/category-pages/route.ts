export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchCategoryPagesAll } from '../../../lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '30daysAgo'
    const endDate = searchParams.get('endDate') || 'today'

    // Fetch all category pages (ending with -kaufen/)
    const pages = await fetchCategoryPagesAll(startDate, endDate)
    
    return NextResponse.json(pages)
  } catch (error: any) {
    console.error('Error in category pages API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category pages' },
      { status: 500 }
    )
  }
}