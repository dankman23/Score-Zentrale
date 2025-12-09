export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { findProspects } from '../../../../services/coldleads/prospector'
import { connectToDatabase } from '@/../lib/api'

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
    
    // Spezifisches Error-Handling für verschiedene Fehlertypen
    let errorMessage = error.message || 'Suche fehlgeschlagen'
    let statusCode = 500
    
    if (error.name === 'MongoNetworkError') {
      errorMessage = 'Datenbankverbindung fehlgeschlagen - bitte später versuchen'
      statusCode = 503
    } else if (error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Google Search API nicht erreichbar'
      statusCode = 503
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Zeitüberschreitung - bitte Limit reduzieren'
      statusCode = 504
    }
    
    return NextResponse.json({
      ok: false,
      error: errorMessage,
      errorType: error.name || 'Error'
    }, { status: statusCode })
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
    const limitParam = searchParams.get('limit')
    // Wenn kein Limit angegeben oder 0, dann KEIN Limit (alle Dokumente)
    const limit = limitParam ? parseInt(limitParam) : 0

    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')

    // Handle filter: "replied" means hasReply=true, otherwise filter by status
    let filter: any = {}
    if (status === 'replied') {
      filter = { hasReply: true }
    } else if (status === 'jtl_customers') {
      // Alle JTL-Kunden (importiert aus JTL-Wawi)
      filter = { customer_source: 'jtl' }
    } else if (status === 'new_customers') {
      // Nur Neukunden (durch Kaltakquise gewonnen)
      filter = { customer_source: 'coldlead', status: 'customer' }
    } else if (status === 'all') {
      // "Alle" = Nur Cold Leads, KEINE JTL-Kunden!
      filter = { 
        $or: [
          { customer_source: { $ne: 'jtl' } },
          { customer_source: { $exists: false } }
        ]
      }
    } else {
      filter = { status }
    }
    
    // Total count ermitteln
    const total = await collection.countDocuments(filter)
    
    // Wenn limit = 0, kein Limit setzen (alle Dokumente)
    const query = collection.find(filter).sort({ created_at: -1 })
    const prospects = limit > 0 
      ? await query.limit(limit).toArray()
      : await query.toArray()

    return NextResponse.json({
      ok: true,
      count: prospects.length,
      total: total,
      prospects: prospects.map(p => ({
        id: p.id || p._id.toString(),
        company_name: p.company_name,
        website: p.website,
        industry: p.industry,
        region: p.region,
        status: p.status,
        score: p.score || p.analysis?.analyse_qualität || p.analysis_v3?.overall_score || null,
        analysis: p.analysis || null,
        analysis_v3: p.analysis_v3 || null,
        email_sequence: p.email_sequence || null,
        followup_schedule: p.followup_schedule || null,
        history: p.history || [],
        hasReply: p.hasReply || false,
        lastReplyAt: p.lastReplyAt || null,
        created_at: p.created_at,
        jtl_customer_match: p.jtl_customer_match || null
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
