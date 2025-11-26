export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { findProspects } from '../../../../services/coldleads/prospector'
import { connectToDatabase } from '../../../lib/api'

/**
 * POST /api/coldleads/search
 * Sucht potenzielle B2B-Kunden
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { industry, region, limit = 10 } = body

    if (!industry || !region) {
      return NextResponse.json({
        ok: false,
        error: 'Branche und Region sind erforderlich'
      }, { status: 400 })
    }

    console.log(`[ColdLeads] Searching: ${industry} in ${region}`)

    // Firmen suchen
    const prospects = await findProspects({ industry, region, limit })

    // Ergebnisse in DB speichern (Duplikate vermeiden via upsert)
    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')
    
    const savedProspects = []
    
    for (const r of prospects) {
      const prospectData = {
        company_name: r.company_name,
        website: r.website,
        description: (r as any).description || '',
        industry: industry,
        region: region,
        status: 'new',
        score: null,
        analysis: null,
        history: [],
        hasReply: false,
        lastReplyAt: null,
        updated_at: new Date()
      }
      
      // Upsert: Update wenn existiert (via website), sonst Insert
      const result = await collection.updateOne(
        { website: r.website },
        { 
          $set: prospectData,
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
      
      // Hole das gespeicherte Dokument
      const savedDoc = await collection.findOne({ website: r.website })
      savedProspects.push({
        id: savedDoc!._id.toString(),
        ...prospectData
      })
    }
    
    return NextResponse.json({
      ok: true,
      count: savedProspects.length,
      prospects: savedProspects
    })

  } catch (error: any) {
    console.error('[ColdLeads Search] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Suche fehlgeschlagen'
    }, { status: 500 })
  }
}

/**
 * GET /api/coldleads/search
 * Liste gespeicherter Prospects
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')

    // Handle filter: "replied" means hasReply=true, otherwise filter by status
    let filter = {}
    if (status === 'replied') {
      filter = { hasReply: true }
    } else if (status !== 'all') {
      filter = { status }
    }
    
    const prospects = await collection
      .find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      ok: true,
      count: prospects.length,
      prospects: prospects.map(p => ({
        id: p.id || p._id.toString(),
        company_name: p.company_name,
        website: p.website,
        industry: p.industry,
        region: p.region,
        status: p.status,
        score: p.score || null,
        analysis: p.analysis || null,
        analysis_v3: p.analysis_v3 || null,
        email_sequence: p.email_sequence || null,
        followup_schedule: p.followup_schedule || null,
        history: p.history || [],
        hasReply: p.hasReply || false,
        lastReplyAt: p.lastReplyAt || null,
        created_at: p.created_at
      }))
    })

  } catch (error: any) {
    console.error('[ColdLeads Get] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
