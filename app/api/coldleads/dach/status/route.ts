export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/../lib/api'

/**
 * GET /api/coldleads/dach/status
 * Zeigt aktuellen Crawling-Fortschritt
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const progressCollection = db.collection('dach_crawl_progress')

    const searchParams = request.nextUrl.searchParams
    const country = searchParams.get('country')
    const industry = searchParams.get('industry')

    // Filter aufbauen
    const filter: any = {}
    if (country) filter.country = country
    if (industry) filter.industry = industry

    // Hole Crawl-Progress
    const progressList = await progressCollection
      .find(filter)
      .sort({ last_updated: -1 })
      .limit(50)
      .toArray()

    // Statistiken berechnen
    const allProgress = await progressCollection.find({}).toArray()
    
    const stats = {
      total_regions: allProgress.length,
      completed: allProgress.filter(p => p.status === 'completed').length,
      in_progress: allProgress.filter(p => p.status === 'in_progress').length,
      pending: allProgress.filter(p => p.status === 'pending').length,
      failed: allProgress.filter(p => p.status === 'failed').length,
      total_companies_found: allProgress.reduce((sum, p) => sum + (p.companies_found || 0), 0)
    }

    return NextResponse.json({
      ok: true,
      stats,
      progress: progressList.map(p => ({
        country: p.country,
        region: p.region,
        industry: p.industry,
        status: p.status,
        companies_found: p.companies_found,
        last_updated: p.last_updated
      }))
    })

  } catch (error: any) {
    console.error('[DACH Status] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
