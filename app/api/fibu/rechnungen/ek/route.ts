export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { findKreditor, learnKreditorMapping, extractBelegnummer } from '../../../../lib/kreditor-matching'

/**
 * GET /api/fibu/rechnungen/ek?from=2025-10-01&to=2025-10-31
 * GET /api/fibu/rechnungen/ek?analyze=true - Analysiere verarbeitete EK-Rechnungen
 * Lädt hochgeladene EK-Rechnungen oder analysiert sie für Lern-Statistiken
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const analyze = searchParams.get('analyze')
    
    // Analyse-Modus: Gib Lern-Statistiken zurück
    if (analyze === 'true') {
      const { analyzeProcessedInvoices } = await import('../../../lib/ek-rechnung-parser')
      const db = await getDb()
      const collection = db.collection('fibu_ek_rechnungen')
      
      const invoices = await collection.find({}).sort({ created_at: -1 }).limit(100).toArray()
      
      const analysis = await analyzeProcessedInvoices(invoices)
      
      return NextResponse.json({
        ok: true,
        totalInvoices: invoices.length,
        statistics: analysis.statistics,
        suggestions: analysis.suggestions,
        message: `Analysiert: ${invoices.length} Rechnungen, ${analysis.suggestions.length} Template-Vorschläge`
      })
    }
    
    // Standard-Modus: Lade Rechnungen nach Datum
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    
    const db = await getDb()
    const rechnungen = await db.collection('fibu_ek_rechnungen')
      .find({
        rechnungsdatum: {
          $gte: new Date(from),
          $lte: new Date(to + 'T23:59:59')
        }
      })
      .sort({ rechnungsdatum: -1 })
      .toArray()
    
    return NextResponse.json({
      ok: true,
      rechnungen,
      count: rechnungen.length
    })
  } catch (error: any) {
    console.error('[EK-Rechnungen GET] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fibu/rechnungen/ek
 * Speichert EK-Rechnung (aus Upload/Parsing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lieferant,
      lieferantName, // Alias für lieferant
      rechnungsnr,
      rechnungsnummer, // Alias für rechnungsnr
      rechnungsdatum,
      eingangsdatum,
      brutto,
      gesamtBetrag, // Alias für brutto
      netto,
      nettoBetrag, // Alias für netto
      mwst,
      mwst_satz,
      steuersatz, // Alias für mwst_satz
      positionen,
      pdf_base64,
      parsed_data,
      kreditorKonto, // Manuell zugeordnet
      aufwandskonto, // Manuell zugeordnet
      beschreibung
    } = body
    
    const finalLieferant = lieferant || lieferantName
    const finalRechnungsnr = rechnungsnr || rechnungsnummer
    const finalBrutto = parseFloat(brutto || gesamtBetrag || '0')
    const finalNetto = parseFloat(netto || nettoBetrag || (finalBrutto / 1.19).toString())
    const finalMwstSatz = parseFloat(steuersatz || mwst_satz || '0.19')
    
    if (!finalLieferant || !finalRechnungsnr || !rechnungsdatum) {
      return NextResponse.json(
        { ok: false, error: 'Pflichtfelder fehlen: Lieferant, Rechnungsnummer, Rechnungsdatum' },
        { status: 400 }
      )
    }
    
    // Auto-Matching: Suche Kreditor
    let matchedKreditor = null
    let autoKreditorKonto = kreditorKonto
    let autoAufwandskonto = aufwandskonto
    
    if (!autoKreditorKonto) {
      matchedKreditor = await findKreditor(finalLieferant)
      
      if (matchedKreditor) {
        autoKreditorKonto = matchedKreditor.kreditorenNummer
        
        // Hole Standard-Aufwandskonto
        const db = await getDb()
        const kreditor = await db.collection('kreditoren').findOne({ 
          kreditorenNummer: matchedKreditor.kreditorenNummer 
        })
        
        if (kreditor && kreditor.standardAufwandskonto) {
          autoAufwandskonto = kreditor.standardAufwandskonto
        }
      }
    }
    
    // Extrahiere Belegnummer (für Amazon XRE-Format)
    const extractedBeleg = extractBelegnummer(finalRechnungsnr)
    const finalBelegnummer = extractedBeleg || finalRechnungsnr
    
    const db = await getDb()
    const rechnung = {
      lieferantName: finalLieferant,
      rechnungsNummer: finalBelegnummer,
      originalRechnungsNummer: finalRechnungsnr,
      rechnungsdatum: new Date(rechnungsdatum),
      eingangsdatum: eingangsdatum ? new Date(eingangsdatum) : new Date(),
      gesamtBetrag: finalBrutto,
      nettoBetrag: finalNetto,
      steuerBetrag: parseFloat(mwst) || (finalBrutto - finalNetto),
      steuersatz: finalMwstSatz,
      kreditorKonto: autoKreditorKonto || null,
      aufwandskonto: autoAufwandskonto || '5200', // Default: Wareneinkauf
      beschreibung: beschreibung || '',
      positionen: positionen || [],
      pdf_base64: pdf_base64 || null,
      parsed_data: parsed_data || null,
      matching: matchedKreditor ? {
        method: matchedKreditor.method,
        confidence: matchedKreditor.confidence,
        matchedName: matchedKreditor.name
      } : null,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('fibu_ek_rechnungen').insertOne(rechnung)
    
    return NextResponse.json({
      ok: true,
      id: result.insertedId,
      message: 'EK-Rechnung gespeichert',
      matching: matchedKreditor ? {
        kreditorKonto: autoKreditorKonto,
        aufwandskonto: autoAufwandskonto,
        confidence: matchedKreditor.confidence,
        method: matchedKreditor.method
      } : null
    })
  } catch (error: any) {
    console.error('[EK-Rechnungen POST] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/fibu/rechnungen/ek
 * Aktualisiert EK-Rechnung (z.B. manuelle Kreditor-Zuordnung)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, kreditorKonto, aufwandskonto } = body
    
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const collection = db.collection('fibu_ek_rechnungen')
    
    // Hole alte Rechnung
    const rechnung = await collection.findOne({ _id: id })
    
    if (!rechnung) {
      return NextResponse.json(
        { ok: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }
    
    // Update
    const updates: any = { updated_at: new Date() }
    
    if (kreditorKonto) {
      updates.kreditorKonto = kreditorKonto
      
      // Lernfunktion: Speichere Mapping
      await learnKreditorMapping(rechnung.lieferantName, kreditorKonto)
    }
    
    if (aufwandskonto) {
      updates.aufwandskonto = aufwandskonto
    }
    
    await collection.updateOne(
      { _id: id },
      { $set: updates }
    )
    
    return NextResponse.json({
      ok: true,
      message: 'EK-Rechnung aktualisiert',
      learned: kreditorKonto ? true : false
    })
  } catch (error: any) {
    console.error('[EK-Rechnungen PUT] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
