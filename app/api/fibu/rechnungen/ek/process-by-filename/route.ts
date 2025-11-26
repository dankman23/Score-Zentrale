export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../../lib/db/mongodb'
import { parseEKRechnung } from '../../../../../lib/ek-rechnung-parser'

// Dynamic import for pdf-parse to avoid Next.js build issues
let pdfParse: any = null

/**
 * POST /api/fibu/rechnungen/ek/process-by-filename
 * 
 * Verarbeitet EK-Rechnung mit Dateiname als Kreditor-Hint
 * Dateiname-Format: "70004.pdf" oder "70004 - Klingspor.pdf"
 * 
 * Body:
 * - pdf_base64: Base64-kodiertes PDF
 * - filename: Dateiname (z.B. "70004.pdf")
 * - emailFrom: Optional - Email-Absender für Domain-Matching
 */
export async function POST(request: NextRequest) {
  try {
    // Load pdf-parse dynamically
    if (!pdfParse) {
      pdfParse = (await import('pdf-parse')).default
    }
    
    const body = await request.json()
    const { pdf_base64, filename, emailFrom } = body
    
    if (!pdf_base64 || !filename) {
      return NextResponse.json(
        { ok: false, error: 'PDF und Filename erforderlich' },
        { status: 400 }
      )
    }
    
    // Extrahiere Kreditor-Nummer aus Dateinamen
    const kreditorNrMatch = filename.match(/^(\d{5})/);  // z.B. "70004"
    const kreditorHint = kreditorNrMatch ? kreditorNrMatch[1] : null
    
    console.log(`[EK Process] Dateiname: ${filename}, Kreditor-Hint: ${kreditorHint}`)
    
    // Hole Kreditor aus DB wenn Hint vorhanden
    let kreditor = null
    if (kreditorHint) {
      const db = await getDb()
      kreditor = await db.collection('kreditoren').findOne({
        kreditorenNummer: kreditorHint
      })
      console.log(`[EK Process] Kreditor gefunden:`, kreditor?.name || 'nicht gefunden')
    }
    
    // PDF parsen
    const pdfBuffer = Buffer.from(pdf_base64, 'base64')
    const pdfData = await pdfParse(pdfBuffer)
    const pdfText = pdfData.text
    
    console.log(`[EK Process] PDF Text-Länge: ${pdfText.length} Zeichen`)
    
    // 1. Versuche Template-Parsing
    let parsedData = await parseEKRechnung(pdfText, emailFrom, filename)
    
    // 2. Fallback: Gemini AI-Parsing wenn Confidence niedrig
    if (parsedData.confidence < 70) {
      console.log(`[EK Process] Template-Parsing Confidence zu niedrig (${parsedData.confidence}%), verwende Gemini...`)
      
      // Kreditor-Name als Hint für Gemini
      const kreditorNameHint = kreditor?.name || ''
      
      const geminiResult = await parseInvoiceWithGemini(pdfText, kreditorNameHint)
      
      parsedData = {
        lieferantName: geminiResult.lieferantName || kreditor?.name || 'Unbekannt',
        rechnungsNummer: geminiResult.rechnungsNummer || '',
        rechnungsDatum: geminiResult.rechnungsDatum || '',
        betrag: geminiResult.betrag || 0,
        nettoBetrag: geminiResult.nettoBetrag,
        steuersatz: geminiResult.steuersatz,
        confidence: 85,  // Gemini hat hohe Confidence
        parsingMethod: 'gemini-ai',
        rawText: pdfText
      }
    }
    
    // 3. Überschreibe Lieferant mit Kreditor wenn vorhanden
    if (kreditor) {
      parsedData.lieferantName = kreditor.name
      parsedData.confidence = Math.min(100, parsedData.confidence + 20)  // Bonus für bekannten Kreditor
    }
    
    // 4. Speichere in DB
    const db = await getDb()
    const rechnung = {
      lieferantName: parsedData.lieferantName,
      rechnungsNummer: parsedData.rechnungsNummer,
      rechnungsdatum: parsedData.rechnungsDatum ? new Date(parsedData.rechnungsDatum) : new Date(),
      eingangsdatum: new Date(),
      gesamtBetrag: parsedData.betrag,
      nettoBetrag: parsedData.nettoBetrag || (parsedData.betrag / 1.19),
      steuerBetrag: parsedData.betrag - (parsedData.nettoBetrag || parsedData.betrag / 1.19),
      steuersatz: parsedData.steuersatz || 19,
      kreditorKonto: kreditor?.kreditorenNummer || null,
      aufwandskonto: kreditor?.standardAufwandskonto || '5200',
      beschreibung: `Aus Email verarbeitet: ${filename}`,
      pdf_base64: pdf_base64,
      parsed_data: parsedData,
      parsing: {
        method: parsedData.parsingMethod,
        confidence: parsedData.confidence,
        kreditorHint: kreditorHint,
        emailFrom: emailFrom || null
      },
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('fibu_ek_rechnungen').insertOne(rechnung)
    
    // 5. Lern-Signal: Update Template wenn erfolgreich
    if (kreditor && parsedData.confidence >= 80) {
      // Hier könnte man das Template verbessern basierend auf den gefundenen Patterns
      console.log(`[EK Process] ✅ Erfolgreich gelernt von ${kreditor.name} (${parsedData.confidence}%)`)
    }
    
    return NextResponse.json({
      ok: true,
      id: result.insertedId,
      rechnung: {
        lieferantName: rechnung.lieferantName,
        rechnungsNummer: rechnung.rechnungsNummer,
        betrag: rechnung.gesamtBetrag,
        kreditorKonto: rechnung.kreditorKonto
      },
      parsing: {
        method: parsedData.parsingMethod,
        confidence: parsedData.confidence,
        kreditorMatched: !!kreditor
      }
    })
    
  } catch (error: any) {
    console.error('[EK Process by Filename] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
