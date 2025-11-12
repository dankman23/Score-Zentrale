export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { processEmailInbox, getPendingEmails } from '../../../lib/email-inbox'
import { getDb } from '../../../lib/db/mongodb'

/**
 * GET /api/fibu/email-inbox
 * Holt pending E-Mails aus Inbox
 */
export async function GET(request: NextRequest) {
  try {
    const emails = await getPendingEmails()
    
    return NextResponse.json({
      ok: true,
      emails: emails.map(e => ({
        id: e._id,
        from: e.emailFrom,
        subject: e.emailSubject,
        date: e.emailDate,
        filename: e.filename,
        fileSize: e.fileSize,
        status: e.status,
        createdAt: e.createdAt
      })),
      count: emails.length
    })
  } catch (error: any) {
    console.error('[Email Inbox GET] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fibu/email-inbox
 * Triggert manuelles Abrufen neuer E-Mails
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Email Inbox] Starte manuelles Abrufen...')
    
    const result = await processEmailInbox()
    
    return NextResponse.json({
      ok: true,
      message: `${result.processed} E-Mail(s) verarbeitet, ${result.pdfs} PDF(s) gespeichert`,
      processed: result.processed,
      pdfs: result.pdfs,
      errors: result.errors
    })
  } catch (error: any) {
    console.error('[Email Inbox POST] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/fibu/email-inbox
 * Verarbeitet ein PDF aus der Inbox und erstellt EK-Rechnung
 * Optional: Mit Gemini-Parsing
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      id, 
      kreditorKonto, 
      aufwandskonto, 
      lieferantName, 
      rechnungsnummer, 
      rechnungsdatum, 
      gesamtBetrag,
      useGemini = false
    } = body
    
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const inboxCol = db.collection('fibu_email_inbox')
    const ekCol = db.collection('fibu_ek_rechnungen')
    
    // Hole E-Mail
    const email = await inboxCol.findOne({ _id: id })
    
    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'E-Mail nicht gefunden' },
        { status: 404 }
      )
    }
    
    let finalData = {
      lieferantName: lieferantName || email.emailFrom,
      rechnungsnummer: rechnungsnummer || 'EMAIL-' + Date.now(),
      rechnungsdatum: rechnungsdatum ? new Date(rechnungsdatum) : email.emailDate,
      gesamtBetrag: parseFloat(gesamtBetrag) || 0
    }
    
    // Gemini-Parsing wenn aktiviert und noch keine Daten vorhanden
    if (useGemini && !lieferantName && email.pdfBase64) {
      try {
        const { extractInvoiceData } = await import('../../../lib/gemini')
        const pdfBuffer = Buffer.from(email.pdfBase64, 'base64')
        const extracted = await extractInvoiceData(pdfBuffer)
        
        if (!extracted.error) {
          finalData = {
            lieferantName: extracted.lieferant || finalData.lieferantName,
            rechnungsnummer: extracted.rechnungsnummer || finalData.rechnungsnummer,
            rechnungsdatum: extracted.datum ? new Date(extracted.datum) : finalData.rechnungsdatum,
            gesamtBetrag: extracted.gesamtbetrag || finalData.gesamtBetrag
          }
        }
      } catch (geminiError) {
        console.error('[Gemini Parsing] Error:', geminiError)
        // Continue with manual data
      }
    }
    
    // Erstelle EK-Rechnung
    const rechnung = {
      lieferantName: finalData.lieferantName,
      rechnungsNummer: finalData.rechnungsnummer,
      rechnungsdatum: finalData.rechnungsdatum,
      eingangsdatum: email.emailDate,
      gesamtBetrag: finalData.gesamtBetrag,
      nettoBetrag: finalData.gesamtBetrag / 1.19,
      steuerBetrag: finalData.gesamtBetrag - (finalData.gesamtBetrag / 1.19),
      steuersatz: 0.19,
      kreditorKonto: kreditorKonto || null,
      aufwandskonto: aufwandskonto || '5200',
      beschreibung: `Email von: ${email.emailFrom}\nBetreff: ${email.emailSubject}`,
      pdf_base64: email.pdfBase64,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await ekCol.insertOne(rechnung)
    
    // Update E-Mail Status
    await inboxCol.updateOne(
      { _id: id },
      {
        $set: {
          status: 'processed',
          processedAt: new Date(),
          rechnungId: result.insertedId
        }
      }
    )
    
    return NextResponse.json({
      ok: true,
      message: 'EK-Rechnung aus E-Mail erstellt',
      rechnungId: result.insertedId
    })
  } catch (error: any) {
    console.error('[Email Inbox PUT] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/fibu/email-inbox
 * Parst PDF mit Gemini und gibt Daten zurück (ohne zu speichern)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body
    
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const inboxCol = db.collection('fibu_email_inbox')
    
    // Hole E-Mail
    const email = await inboxCol.findOne({ _id: id })
    
    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'E-Mail nicht gefunden' },
        { status: 404 }
      )
    }
    
    if (!email.pdfBase64) {
      return NextResponse.json(
        { ok: false, error: 'Kein PDF-Anhang gefunden' },
        { status: 400 }
      )
    }
    
    // Parse mit Gemini
    const { extractInvoiceData } = await import('../../../lib/gemini')
    const pdfBuffer = Buffer.from(email.pdfBase64, 'base64')
    const extracted = await extractInvoiceData(pdfBuffer)
    
    return NextResponse.json({
      ok: true,
      extracted
    })
  } catch (error: any) {
    console.error('[Email Inbox PATCH] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
