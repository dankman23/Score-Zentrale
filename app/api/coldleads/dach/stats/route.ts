export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCrawlStatistics } from '../../../../../../services/coldleads/dach-crawler'
import { connectToDatabase } from '../../../../lib/api'

/**
 * GET /api/coldleads/dach/stats
 * Statistiken über DACH-Crawling
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const progressCollection = db.collection('dach_crawl_progress')
    const prospectsCollection = db.collection('cold_prospects')

    // Gesamt-Statistiken
    const allProgress = await progressCollection.find({}).toArray()
    
    const totalRegions = 47 // 16 DE + 9 AT + 22 CH
    const completedRegions = allProgress.filter(p => p.status === 'completed').length
    const totalCompanies = allProgress.reduce((sum, p) => sum + (p.companies_found || 0), 0)

    // Länder-Breakdown
    const countryStats = {
      DE: {
        regions_completed: allProgress.filter(p => p.country === 'DE' && p.status === 'completed').length,
        total_regions: 16,
        companies_found: allProgress
          .filter(p => p.country === 'DE')
          .reduce((sum, p) => sum + (p.companies_found || 0), 0)
      },
      AT: {
        regions_completed: allProgress.filter(p => p.country === 'AT' && p.status === 'completed').length,
        total_regions: 9,
        companies_found: allProgress
          .filter(p => p.country === 'AT')
          .reduce((sum, p) => sum + (p.companies_found || 0), 0)
      },
      CH: {
        regions_completed: allProgress.filter(p => p.country === 'CH' && p.status === 'completed').length,
        total_regions: 22,
        companies_found: allProgress
          .filter(p => p.country === 'CH')
          .reduce((sum, p) => sum + (p.companies_found || 0), 0)
      }
    }

    // Branchen-Breakdown
    const industryStats: Record<string, number> = {}
    for (const p of allProgress) {
      if (!industryStats[p.industry]) {
        industryStats[p.industry] = 0
      }
      industryStats[p.industry] += p.companies_found || 0
    }

    // Top Industrien
    const topIndustries = Object.entries(industryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([industry, count]) => ({ industry, count }))

    // Prospects aus DACH Crawler
    const dachProspects = await prospectsCollection
      .find({ source: /DACH Crawler/i })
      .count()

    return NextResponse.json({
      ok: true,
      stats: {
        total_regions: totalRegions,
        completed_regions: completedRegions,
        pending_regions: totalRegions - completedRegions,
        total_companies_found: totalCompanies,
        coverage_percentage: Math.round((completedRegions / totalRegions) * 100),
        dach_prospects_in_db: dachProspects
      },
      country_breakdown: countryStats,
      top_industries: topIndustries,
      last_updated: new Date()
    })

  } catch (error: any) {
    console.error('[DACH Stats] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
