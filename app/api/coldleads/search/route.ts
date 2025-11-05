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

    // In MongoDB speichern
    const { db } = await connectToDatabase()
    const collection = db.collection('cold_prospects')

    // Bulk insert mit Duplikat-Schutz
    const operations = prospects.map(p => ({
      updateOne: {
        filter: { website: p.website },
        update: {
          $set: {
            ...p,
            industry,
            region,
            status: 'new',
            created_at: new Date(),
            updated_at: new Date()
          }
        },
        upsert: true
      }
    }))

    if (operations.length > 0) {
      await collection.bulkWrite(operations)
    }

    return NextResponse.json({
      ok: true,
      count: prospects.length,
      prospects: prospects.map(p => ({
        ...p,
        status: 'new',
        id: p.website // Temporäre ID
      }))
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
    const collection = db.collection('cold_prospects')

    const filter = status !== 'all' ? { status } : {}
    
    const prospects = await collection
      .find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      ok: true,
      count: prospects.length,
      prospects: prospects.map(p => ({
        id: p._id.toString(),
        company_name: p.company_name,
        website: p.website,
        industry: p.industry,
        region: p.region,
        status: p.status,
        score: p.score || null,
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
