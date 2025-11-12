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
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, kreditorKonto, aufwandskonto, lieferantName, rechnungsnummer, rechnungsdatum, gesamtBetrag } = body
    
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
    
    // Erstelle EK-Rechnung
    const rechnung = {
      lieferantName: lieferantName || email.emailFrom,
      rechnungsNummer: rechnungsnummer || 'EMAIL-' + Date.now(),
      rechnungsdatum: rechnungsdatum ? new Date(rechnungsdatum) : email.emailDate,
      eingangsdatum: email.emailDate,
      gesamtBetrag: parseFloat(gesamtBetrag) || 0,
      nettoBetrag: parseFloat(gesamtBetrag) / 1.19 || 0,
      steuerBetrag: parseFloat(gesamtBetrag) - (parseFloat(gesamtBetrag) / 1.19) || 0,
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
