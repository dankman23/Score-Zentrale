export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../../lib/db/mongodb'
import { parseEKRechnung } from '../../../../../lib/ek-rechnung-parser'
import { extractInvoiceData } from '../../../../../lib/gemini'

// Dynamic import for pdf-parse to avoid Next.js build issues
let pdfParse: any = null
async function getPdfParse() {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse')).default
  }
  return pdfParse
}

/**
 * POST /api/fibu/rechnungen/ek/batch-process
 * 
 * Verarbeitet alle pending PDFs aus fibu_email_inbox
 * Mit intelligentem Parsing (Template + Gemini) und Kreditor-Matching
 * 
 * Query params:
 * - limit: Max Anzahl zu verarbeiten (default: 20)
 * - test: true = Nur testen ohne zu speichern
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const testMode = searchParams.get('test') === 'true'
    
    const db = await getDb()
    const inboxCol = db.collection('fibu_email_inbox')
    const ekCol = db.collection('fibu_ek_rechnungen')
    const kreditorenCol = db.collection('kreditoren')
    
    // Hole pending PDFs
    const pendingPDFs = await inboxCol.find({
      status: 'pending'
    }).limit(limit).toArray()
    
    if (pendingPDFs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Keine pending PDFs zum Verarbeiten',
        processed: 0
      })
    }
    
    console.log(`[Batch Process] Starte Verarbeitung von ${pendingPDFs.length} PDFs...`)
    
    const results = []
    let successCount = 0
    let errorCount = 0
    
    for (const pdf of pendingPDFs) {
      try {
        console.log(`\n[Batch] Verarbeite: ${pdf.filename}`)
        
        // 1. PDF Text extrahieren
        const pdfBuffer = Buffer.from(pdf.pdfBase64, 'base64')
        const parser = await getPdfParse()
        const pdfData = await parser(pdfBuffer)
        const pdfText = pdfData.text
        
        // 2. Extrahiere Kreditor-Hint aus Dateinamen
        // Format: "70004.pdf" oder "70004 - Name.pdf" oder "KLINGSPOR Rechnung..."
        const kreditorNrMatch = pdf.filename.match(/^(\d{5})/)
        let kreditorHint = kreditorNrMatch ? kreditorNrMatch[1] : null
        
        // Suche auch nach Lieferanten-Namen im Dateinamen
        let kreditor = null
        if (kreditorHint) {
          kreditor = await kreditorenCol.findOne({ kreditorenNummer: kreditorHint })
        }
        
        // Fallback: Suche nach Namen im Dateinamen
        if (!kreditor) {
          const nameParts = pdf.filename.toLowerCase()
          if (nameParts.includes('klingspor')) {
            kreditor = await kreditorenCol.findOne({ name: /Klingspor/i })
          } else if (nameParts.includes('rüggeberg') || nameParts.includes('ruggeberg')) {
            kreditor = await kreditorenCol.findOne({ name: /Rüggeberg/i })
          } else if (nameParts.includes('vsm')) {
            kreditor = await kreditorenCol.findOne({ name: /VSM/i })
          } else if (nameParts.includes('starcke')) {
            kreditor = await kreditorenCol.findOne({ name: /Starcke/i })
          }
        }
        
        console.log(`[Batch] Kreditor-Hint: ${kreditorHint || 'keiner'}, Gefunden: ${kreditor?.name || 'nein'}`)
        
        // 3. Intelligentes Parsing
        let parsedData = await parseEKRechnung(pdfText, pdf.emailFrom, pdf.filename)
        
        console.log(`[Batch] Template-Parsing: ${parsedData.parsingMethod} (${parsedData.confidence}%)`)
        
        // 4. Fallback: Gemini wenn Confidence niedrig
        if (parsedData.confidence < 70 && process.env.GOOGLE_API_KEY) {
          try {
            const pdfBuffer = Buffer.from(pdf.pdfBase64, 'base64')
            const geminiResult = await extractInvoiceData(pdfBuffer, undefined, {
              from: pdf.emailFrom,
              subject: pdf.subject,
              body: ''
            })
            
            if (geminiResult && !geminiResult.error) {
              parsedData = {
                lieferantName: geminiResult.lieferant || kreditor?.name || 'Unbekannt',
                rechnungsNummer: geminiResult.rechnungsnummer || '',
                rechnungsDatum: geminiResult.datum || '',
                betrag: geminiResult.gesamtbetrag || 0,
                nettoBetrag: geminiResult.nettobetrag,
                steuersatz: geminiResult.mwstSatz,
                confidence: 85,
                parsingMethod: 'gemini-ai',
                rawText: pdfText
              }
              console.log(`[Batch] Gemini-Parsing: ${parsedData.lieferantName}, ${parsedData.betrag}€`)
            }
          } catch (geminiError) {
            console.log(`[Batch] Gemini-Fehler: ${geminiError}`)
            // Continue with template parsing result
          }
        }
        
        // 5. Überschreibe mit Kreditor wenn vorhanden
        if (kreditor) {
          parsedData.lieferantName = kreditor.name
          parsedData.confidence = Math.min(100, parsedData.confidence + 15)
        }
        
        // 6. Validierung
        if (!parsedData.rechnungsNummer || parsedData.betrag === 0) {
          console.log(`[Batch] ⚠️ Unvollständige Daten: RgNr=${parsedData.rechnungsNummer}, Betrag=${parsedData.betrag}`)
          errorCount++
          results.push({
            filename: pdf.filename,
            status: 'error',
            reason: 'Unvollständige Daten',
            parsed: parsedData
          })
          continue
        }
        
        // 7. Speichere wenn nicht Test-Modus
        if (!testMode) {
          const rechnung = {
            lieferantName: parsedData.lieferantName,
            rechnungsNummer: parsedData.rechnungsNummer,
            rechnungsdatum: parsedData.rechnungsDatum ? new Date(parsedData.rechnungsDatum) : new Date(),
            eingangsdatum: new Date(pdf.emailDate),
            gesamtBetrag: parsedData.betrag,
            nettoBetrag: parsedData.nettoBetrag || (parsedData.betrag / 1.19),
            steuerBetrag: parsedData.betrag - (parsedData.nettoBetrag || parsedData.betrag / 1.19),
            steuersatz: parsedData.steuersatz || 19,
            kreditorKonto: kreditor?.kreditorenNummer || null,
            aufwandskonto: kreditor?.standardAufwandskonto || '5200',
            beschreibung: `Email von ${pdf.emailFrom} - ${pdf.filename}`,
            pdf_base64: pdf.pdfBase64,
            parsed_data: parsedData,
            parsing: {
              method: parsedData.parsingMethod,
              confidence: parsedData.confidence,
              kreditorHint: kreditorHint,
              emailFrom: pdf.emailFrom
            },
            sourceEmailId: pdf._id,
            created_at: new Date(),
            updated_at: new Date()
          }
          
          await ekCol.insertOne(rechnung)
          
          // Update Inbox Status
          await inboxCol.updateOne(
            { _id: pdf._id },
            { 
              $set: { 
                status: 'processed',
                processedAt: new Date(),
                rechnungId: rechnung._id
              }
            }
          )
          
          console.log(`[Batch] ✅ Gespeichert: ${parsedData.lieferantName} - ${parsedData.rechnungsNummer} (${parsedData.betrag}€)`)
        }
        
        successCount++
        results.push({
          filename: pdf.filename,
          status: 'success',
          lieferant: parsedData.lieferantName,
          rechnungsNr: parsedData.rechnungsNummer,
          betrag: parsedData.betrag,
          confidence: parsedData.confidence,
          method: parsedData.parsingMethod
        })
        
      } catch (error: any) {
        console.error(`[Batch] ❌ Fehler bei ${pdf.filename}:`, error.message)
        errorCount++
        results.push({
          filename: pdf.filename,
          status: 'error',
          reason: error.message
        })
      }
    }
    
    console.log(`\n[Batch] Abgeschlossen: ${successCount} erfolg, ${errorCount} Fehler`)
    
    return NextResponse.json({
      ok: true,
      processed: pendingPDFs.length,
      success: successCount,
      errors: errorCount,
      testMode,
      results
    })
    
  } catch (error: any) {
    console.error('[Batch Process] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET: Statistiken über verarbeitete Rechnungen
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const inboxCol = db.collection('fibu_email_inbox')
    const ekCol = db.collection('fibu_ek_rechnungen')
    
    const totalPDFs = await inboxCol.countDocuments()
    const pendingPDFs = await inboxCol.countDocuments({ status: 'pending' })
    const processedPDFs = await inboxCol.countDocuments({ status: 'processed' })
    const errorPDFs = await inboxCol.countDocuments({ status: 'error' })
    
    const totalEK = await ekCol.countDocuments()
    
    // Statistik nach Lieferant
    const byLieferant = await ekCol.aggregate([
      { $group: { _id: '$lieferantName', count: { $sum: 1 }, totalBetrag: { $sum: '$gesamtBetrag' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()
    
    // Statistik nach Parsing-Method
    const byMethod = await ekCol.aggregate([
      { $group: { _id: '$parsing.method', count: { $sum: 1 }, avgConfidence: { $avg: '$parsing.confidence' } } },
      { $sort: { count: -1 } }
    ]).toArray()
    
    return NextResponse.json({
      ok: true,
      inbox: {
        total: totalPDFs,
        pending: pendingPDFs,
        processed: processedPDFs,
        error: errorPDFs
      },
      ekRechnungen: {
        total: totalEK,
        byLieferant,
        byMethod
      }
    })
    
  } catch (error: any) {
    console.error('[Batch Stats] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
