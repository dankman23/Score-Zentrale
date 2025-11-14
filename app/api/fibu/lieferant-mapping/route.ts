export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * Lieferant-Kreditor-Mapping
 * Speichert welcher Lieferant zu welchem Kreditor gehört
 */

// GET - Hole Mapping
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    
    const mappings = await db.collection('fibu_lieferant_kreditor_mapping').find({}).toArray()
    
    return NextResponse.json({
      ok: true,
      mappings: mappings
    })
    
  } catch (error: any) {
    console.error('[Lieferant-Mapping] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Erstelle oder Update Mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lieferantName, kreditorKonto } = body
    
    if (!lieferantName || !kreditorKonto) {
      return NextResponse.json({ 
        error: 'lieferantName und kreditorKonto erforderlich' 
      }, { status: 400 })
    }
    
    const db = await getDb()
    
    // Upsert: Update wenn vorhanden, sonst insert
    const result = await db.collection('fibu_lieferant_kreditor_mapping').updateOne(
      { lieferantName: lieferantName },
      { 
        $set: { 
          lieferantName,
          kreditorKonto,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    )
    
    console.log(`[Lieferant-Mapping] Gespeichert: ${lieferantName} → ${kreditorKonto}`)
    
    return NextResponse.json({
      ok: true,
      message: 'Mapping gespeichert',
      upserted: result.upsertedCount > 0
    })
    
  } catch (error: any) {
    console.error('[Lieferant-Mapping] Fehler:', error)
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
