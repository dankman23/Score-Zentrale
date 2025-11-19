/**
 * API: Deep Company Analysis für SCORE
 * Analysiert eine Firma komplett und extrahiert alle relevanten Daten
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeFirmaForScore } from '@/services/coldleads/score-analyzer'
import { getDb } from '@/lib/db/mongodb'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { website, firmenname, branche, prospectId } = await req.json()
    
    if (!website) {
      return NextResponse.json(
        { error: 'Website URL erforderlich' },
        { status: 400 }
      )
    }
    
    console.log(`[Deep Analysis] Start für: ${website}`)
    
    // Analyse durchführen
    const result = await analyzeFirmaForScore(website, firmenname, branche)
    
    console.log(`[Deep Analysis] Qualität: ${result.analyse_qualität}%`)
    console.log(`[Deep Analysis] Kontakte gefunden: ${result.kontaktpersonen.length}`)
    console.log(`[Deep Analysis] Produktempfehlungen: ${result.potenzielle_produkte.length}`)
    
    // Speichere Analyse in DB (wenn prospectId vorhanden)
    if (prospectId) {
      const db = await getDb()
      const collection = db.collection('prospects')
      
      await collection.updateOne(
        { _id: prospectId },
        {
          $set: {
            status: 'analyzed', // WICHTIG: Status auf analyzed setzen!
            analyzed: true,
            analyzed_at: new Date(),
            analysis: result,
            // Flatten wichtige Felder für einfacheren Zugriff
            branche: result.branche,
            werkstoffe: result.werkstoffe.map(w => w.name),
            werkstücke: result.werkstücke.map(w => w.name),
            kontakte: result.kontaktpersonen,
            products_recommended: result.potenzielle_produkte.map(p => p.kategorie),
            firmenprofil: result.firmenprofil,
            analysis_quality: result.analyse_qualität
          }
        }
      )
      
      console.log(`[Deep Analysis] Gespeichert für Prospect: ${prospectId} - Status: analyzed`)
    }
    
    return NextResponse.json({
      ok: true,
      success: true,
      analysis: result
    })
    
  } catch (error: any) {
    console.error('[Deep Analysis] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Analyse fehlgeschlagen' },
      { status: 500 }
    )
  }
}

/**
 * GET: Lade gespeicherte Analyse
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const prospectId = searchParams.get('prospectId')
    
    if (!prospectId) {
      return NextResponse.json(
        { error: 'prospectId erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const collection = db.collection('prospects')
    
    const prospect = await collection.findOne({ _id: prospectId })
    
    if (!prospect || !prospect.analysis) {
      return NextResponse.json(
        { error: 'Keine Analyse gefunden' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      analysis: prospect.analysis
    })
    
  } catch (error: any) {
    console.error('[Deep Analysis GET] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
