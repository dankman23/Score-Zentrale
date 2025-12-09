/**
 * API: Deep Company Analysis für SCORE
 * Analysiert eine Firma komplett und extrahiert alle relevanten Daten
 */

import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { analyzeFirmaForScore } from '@/services/coldleads/score-analyzer'
import { connectToDatabase } from '@/../lib/api'
import { getDb } from '@/../lib/db/mongodb'

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
      const { db } = await connectToDatabase()
      const collection = db.collection('prospects')
      
      // Konvertiere prospectId zu ObjectId für MongoDB
      let query
      try {
        query = { _id: new ObjectId(prospectId) }
      } catch (e) {
        // Falls keine gültige ObjectId, suche nach custom id field
        query = { id: prospectId }
      }
      
      console.log(`[Deep Analysis] Updating prospect with query:`, query)
      
      // Prüfe ob gültige E-Mail gefunden wurde
      const contactEmail = result.kontaktpersonen[0]?.email
      const hasValidEmail = contactEmail && typeof contactEmail === 'string' && contactEmail.length > 5 && contactEmail.includes('@')
      
      // Status: 'analyzed' wenn E-Mail vorhanden, sonst 'no_email'
      const newStatus = hasValidEmail ? 'analyzed' : 'no_email'
      
      const updateResult = await collection.updateOne(
        query,
        {
          $set: {
            status: newStatus,
            analyzed: true,
            analyzed_at: new Date(),
            analysis: result, // Kompatibilität
            analysis_v3: {
              contact_person: result.kontaktpersonen[0] || {},
              materials: result.werkstoffe.map(w => w.name),
              applications: result.anwendungen || [],
              machines: result.werkstücke.map(w => w.name),
              products_recommended: result.potenzielle_produkte.map(p => p.kategorie),
              firmenprofil: result.firmenprofil,
              analysis_quality: result.analyse_qualität
            },
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
      
      console.log(`[Deep Analysis] Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`)
      console.log(`[Deep Analysis] Gespeichert für Prospect: ${prospectId} - Status: ${newStatus}${!hasValidEmail ? ' (KEINE E-MAIL)' : ''}`)
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
    
    const prospect = await collection.findOne({ _id: new ObjectId(prospectId) })
    
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
