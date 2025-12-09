export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/mongodb'

/**
 * GET /api/fibu/kreditoren
 * Liste aller Kreditoren
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const collection = db.collection('kreditoren')
    
    const kreditoren = await collection.find({}).sort({ kreditorenNummer: 1 }).toArray()
    
    return NextResponse.json({
      ok: true,
      kreditoren: kreditoren.map(k => ({
        id: k._id,
        kreditorenNummer: k.kreditorenNummer,
        name: k.name,
        standardAufwandskonto: k.standardAufwandskonto || '',
        aliases: k.aliases || [],
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
      })),
      total: kreditoren.length
    })
  } catch (error: any) {
    console.error('[Kreditoren GET] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fibu/kreditoren
 * Neuen Kreditor anlegen oder Batch-Import
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const db = await getDb()
    const collection = db.collection('kreditoren')
    
    // Batch-Import (Array)
    if (Array.isArray(body)) {
      const results = []
      
      for (const kreditor of body) {
        const { kreditorenNummer, name, standardAufwandskonto } = kreditor
        
        if (!kreditorenNummer || !name) {
          results.push({ 
            kreditorenNummer, 
            name, 
            success: false, 
            error: 'Kreditorennummer und Name erforderlich' 
          })
          continue
        }
        
        // Upsert: Aktualisiere wenn vorhanden, sonst neu anlegen
        const result = await collection.updateOne(
          { kreditorenNummer },
          {
            $set: {
              name,
              standardAufwandskonto: standardAufwandskonto || '',
              updatedAt: new Date()
            },
            $setOnInsert: {
              aliases: [],
              createdAt: new Date()
            }
          },
          { upsert: true }
        )
        
        results.push({
          kreditorenNummer,
          name,
          success: true,
          upserted: result.upsertedCount > 0,
          modified: result.modifiedCount > 0
        })
      }
      
      const successful = results.filter(r => r.success).length
      
      return NextResponse.json({
        ok: true,
        message: `${successful} von ${body.length} Kreditoren importiert`,
        results
      })
    }
    
    // Einzelner Kreditor
    const { kreditorenNummer, name, standardAufwandskonto } = body
    
    if (!kreditorenNummer || !name) {
      return NextResponse.json(
        { ok: false, error: 'Kreditorennummer und Name erforderlich' },
        { status: 400 }
      )
    }
    
    const result = await collection.updateOne(
      { kreditorenNummer },
      {
        $set: {
          name,
          standardAufwandskonto: standardAufwandskonto || '',
          updatedAt: new Date()
        },
        $setOnInsert: {
          aliases: [],
          createdAt: new Date()
        }
      },
      { upsert: true }
    )
    
    return NextResponse.json({
      ok: true,
      message: result.upsertedCount > 0 ? 'Kreditor angelegt' : 'Kreditor aktualisiert',
      kreditorenNummer,
      upserted: result.upsertedCount > 0
    })
  } catch (error: any) {
    console.error('[Kreditoren POST] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/fibu/kreditoren
 * Kreditor aktualisieren (z.B. Alias hinzufügen)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { kreditorenNummer, alias } = body
    
    if (!kreditorenNummer) {
      return NextResponse.json(
        { ok: false, error: 'Kreditorennummer erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const collection = db.collection('kreditoren')
    
    // Alias hinzufügen (für Lernfunktion)
    if (alias) {
      await collection.updateOne(
        { kreditorenNummer },
        {
          $addToSet: { aliases: alias.toLowerCase().trim() },
          $set: { updatedAt: new Date() }
        }
      )
      
      return NextResponse.json({
        ok: true,
        message: 'Alias hinzugefügt',
        kreditorenNummer,
        alias
      })
    }
    
    return NextResponse.json(
      { ok: false, error: 'Keine Aktion spezifiziert' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[Kreditoren PUT] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
