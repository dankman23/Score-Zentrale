export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { crawlDACHRegion } from '@/services/coldleads/dach-crawler'
import { connectToDatabase } from '../../../lib/api'

/**
 * POST /api/coldleads/dach/crawl
 * Startet systematisches DACH-Crawling
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      country = 'DE', 
      region, 
      industry,
      limit = 20
    } = body

    if (!region || !industry) {
      return NextResponse.json({
        ok: false,
        error: 'Region und Branche sind erforderlich'
      }, { status: 400 })
    }

    if (!['DE', 'AT', 'CH'].includes(country)) {
      return NextResponse.json({
        ok: false,
        error: 'Ungültiges Land. Erlaubt: DE, AT, CH'
      }, { status: 400 })
    }

    console.log(`[DACH Crawl] Starting: ${country}/${region}/${industry}`)

    // Crawle die Region
    const result = await crawlDACHRegion(
      country as 'DE' | 'AT' | 'CH',
      region,
      industry,
      limit
    )

    // Speichere gefundene Leads in MongoDB
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    const progressCollection = db.collection('dach_crawl_progress')

    const savedProspects = []
    
    // Hilfsfunktion: Normalisiere URL zu Hauptdomain (ohne /impressum/, /kontakt/ etc.)
    const normalizeWebsite = (url: string): string => {
      if (!url) return url
      try {
        const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url)
        return `${urlObj.protocol}//${urlObj.hostname}`
      } catch (e) {
        // Fallback: Entferne nur den Pfad
        return url.replace(/\/[^\/]*\/?$/, '')
      }
    }

    for (const lead of result.leads) {
      // Normalisiere Website-URL zu Hauptdomain
      const normalizedWebsite = normalizeWebsite(lead.website || '')
      
      const prospectData = {
        company_name: lead.name,
        website: normalizedWebsite,
        website_original: lead.website, // Speichere Original-URL für Referenz
        description: lead.address || '',
        industry: lead.industry,
        region: lead.city,
        country: lead.country,
        status: 'new',
        score: null,
        analysis: null,
        history: [],
        source: `DACH Crawler: ${lead.source}`,
        hasReply: false,
        lastReplyAt: null,
        updated_at: new Date()
      }

      // Upsert: Update wenn existiert (via normalisierte website), sonst Insert
      if (normalizedWebsite) {
        await prospectsCollection.updateOne(
          { website: normalizedWebsite },
          {
            $set: prospectData,
            $setOnInsert: { created_at: new Date() }
          },
          { upsert: true }
        )

        // FIXED: Suche nach normalisierter Website, nicht Original
        const savedDoc = await prospectsCollection.findOne({ website: normalizedWebsite })
        if (savedDoc) {
          savedProspects.push({
            id: savedDoc._id.toString(),
            ...prospectData
          })
        }
      }
    }

    // Speichere Crawl-Progress
    await progressCollection.updateOne(
      {
        country: result.progress.country,
        region: result.progress.region,
        industry: result.progress.industry
      },
      {
        $set: {
          ...result.progress,
          last_updated: new Date()
        }
      },
      { upsert: true }
    )

    return NextResponse.json({
      ok: true,
      count: savedProspects.length,
      prospects: savedProspects,
      progress: result.progress,
      nextRegion: result.nextRegion
    })

  } catch (error: any) {
    console.error('[DACH Crawl] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Crawling fehlgeschlagen'
    }, { status: 500 })
  }
}
