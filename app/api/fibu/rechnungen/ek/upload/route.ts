export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { extractInvoiceData } from '../../../../../lib/gemini'
import { getDb } from '../../../../../lib/db/mongodb'

/**
 * POST /api/fibu/rechnungen/ek/upload
 * Lädt EK-Rechnung als PDF hoch und extrahiert Daten mit Gemini
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
    
    // Check if it's a PDF
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { ok: false, error: 'Nur PDF-Dateien werden unterstützt' },
        { status: 400 }
      )
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: 'Datei zu groß (max. 10MB)' },
        { status: 400 }
      )
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Extract invoice data using Gemini
    console.log('Extracting invoice data with Gemini 2.0 Flash...')
    const extractedData = await extractInvoiceData(buffer)
    
    // Save to MongoDB
    const db = await getDb()
    const collection = db.collection('fibu_ek_rechnungen')
    
    const ekRechnung = {
      rechnungsnummer: extractedData.rechnungsnummer || 'Unbekannt',
      datum: extractedData.datum || new Date().toISOString(),
      lieferant: extractedData.lieferant || 'Unbekannt',
      lieferantenNummer: extractedData.lieferantenNummer || null,
      gesamtbetrag: extractedData.gesamtbetrag || 0,
      nettobetrag: extractedData.nettobetrag || 0,
      mehrwertsteuer: extractedData.mehrwertsteuer || 0,
      mwstSatz: extractedData.mwstSatz || 19,
      zahlungsbedingungen: extractedData.zahlungsbedingungen || null,
      positionen: extractedData.positionen || [],
      status: 'Offen',
      pdfDateiname: file.name,
      pdfSize: file.size,
      pdfData: buffer.toString('base64'), // Store PDF as base64
      extractedAt: new Date(),
      created_at: new Date()
    }
    
    const result = await collection.insertOne(ekRechnung)
    
    return NextResponse.json({
      ok: true,
      message: 'Rechnung erfolgreich hochgeladen und extrahiert',
      data: {
        id: result.insertedId,
        ...ekRechnung,
        pdfData: undefined // Don't send PDF data back in response
      }
    })
  } catch (error: any) {
    console.error('[EK-Rechnung Upload] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
