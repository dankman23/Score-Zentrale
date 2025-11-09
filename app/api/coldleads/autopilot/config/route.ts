export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../../../lib/mongodb'

/**
 * GET /api/coldleads/autopilot/config
 * Gibt aktuelle Autopilot-Konfiguration zurück
 */
export async function GET() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('autopilot_state')
    
    const state = await collection.findOne({ id: 'kaltakquise' })
    
    // Import Search Strategy für verfügbare Optionen
    const { TARGET_INDUSTRIES, TARGET_REGIONS } = await import('../../../../../services/coldleads/search-strategy')
    
    return NextResponse.json({
      ok: true,
      config: {
        preferredIndustries: state?.preferredIndustries || [],
        preferredRegions: state?.preferredRegions || [],
        lastSearchQuery: state?.lastSearchQuery || null
      },
      available: {
        industries: TARGET_INDUSTRIES,
        regions: TARGET_REGIONS
      }
    })
  } catch (error: any) {
    console.error('[Autopilot Config] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}

/**
 * PUT /api/coldleads/autopilot/config
 * Setzt Autopilot Such-Präferenzen
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { preferredIndustries, preferredRegions } = body
    
    const db = await connectToMongoDB()
    const collection = db.collection('autopilot_state')
    
    const update: any = {}
    
    if (preferredIndustries !== undefined) {
      if (!Array.isArray(preferredIndustries)) {
        return NextResponse.json({
          ok: false,
          error: 'preferredIndustries muss ein Array sein'
        }, { status: 400 })
      }
      update.preferredIndustries = preferredIndustries
    }
    
    if (preferredRegions !== undefined) {
      if (!Array.isArray(preferredRegions)) {
        return NextResponse.json({
          ok: false,
          error: 'preferredRegions muss ein Array sein'
        }, { status: 400 })
      }
      update.preferredRegions = preferredRegions
    }
    
    if (Object.keys(update).length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Änderungen angegeben'
      }, { status: 400 })
    }
    
    await collection.updateOne(
      { id: 'kaltakquise' },
      { 
        $set: update,
        $setOnInsert: { id: 'kaltakquise', running: false }
      },
      { upsert: true }
    )
    
    console.log('[Autopilot Config] Updated:', update)
    
    return NextResponse.json({
      ok: true,
      message: 'Konfiguration aktualisiert',
      config: update
    })
    
  } catch (error: any) {
    console.error('[Autopilot Config] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
