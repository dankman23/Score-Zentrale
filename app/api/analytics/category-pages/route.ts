export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchCategoryPages } from '../../../../lib/analytics'

// Defined category pages
const CATEGORY_PATHS = [
  '/schleifbaender-kaufen/',
  '/schleifpapier-kaufen/',
  '/schleifscheibe-kaufen/',
  '/trennscheiben-kaufen/',
  '/faecherscheibe-kaufen/',
  '/fiberscheiben-kaufen/',
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '30daysAgo'
    const endDate = searchParams.get('endDate') || 'today'

    const pages = await fetchCategoryPages(CATEGORY_PATHS, startDate, endDate)
    
    return NextResponse.json(pages)
  } catch (error: any) {
    console.error('Error in category pages API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category pages' },
      { status: 500 }
    )
  }
}