export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { parseKontenplanExcel, validateKonto, getKontenklasse, getKontenklasseName } from '../../../../lib/kontenplan-utils'

/**
 * POST /api/fibu/kontenplan/import
 * Importiert einen Kontenplan aus einer Excel-Datei
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }
    
    // Datei zu Buffer konvertieren
    const arrayBuffer = await file.arrayBuffer()
    
    // Excel parsen
    const konten = parseKontenplanExcel(arrayBuffer)
    
    if (konten.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Keine Konten in der Excel-Datei gefunden' },
        { status: 400 }
      )
    }
    
    // Validieren
    const validKonten = konten.filter(validateKonto)
    
    if (validKonten.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Keine validen Konten gefunden' },
        { status: 400 }
      )
    }
    
    // In Datenbank importieren
    const db = await getDb()
    const collection = db.collection('fibu_konten')
    
    let imported = 0
    let updated = 0
    let errors = 0
    
    for (const konto of validKonten) {
      try {
        const result = await collection.updateOne(
          { konto: konto.konto },
          {
            $set: {
              konto: konto.konto,
              bezeichnung: konto.bezeichnung,
              kontenklasse: konto.kontenklasse,
              kontenklasseName: konto.kontenklasseName,
              typ: konto.typ,
              updated_at: new Date()
            },
            $setOnInsert: {
              created_at: new Date(),
              aktiv: true
            }
          },
          { upsert: true }
        )
        
        if (result.upsertedCount > 0) {
          imported++
        } else if (result.modifiedCount > 0) {
          updated++
        }
      } catch (err) {
        console.error('Fehler beim Import von Konto:', konto.konto, err)
        errors++
      }
    }
    
    return NextResponse.json({
      ok: true,
      message: `Import abgeschlossen: ${imported} neu, ${updated} aktualisiert, ${errors} Fehler`,
      stats: {
        total: validKonten.length,
        imported,
        updated,
        errors
      }
    })
  } catch (error: any) {
    console.error('[Kontenplan Import] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
