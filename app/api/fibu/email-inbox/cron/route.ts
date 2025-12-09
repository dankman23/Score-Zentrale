export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { processEmailInbox } from '../../../lib/email-inbox'

/**
 * GET /api/fibu/email-inbox/cron
 * Automatischer Cron-Job (aufgerufen von externem Service oder interner Scheduler)
 * Sollte alle 5-15 Minuten aufgerufen werden
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Email Inbox Cron] Starte automatisches Abrufen...')
    
    const result = await processEmailInbox()
    
    const message = result.pdfs > 0
      ? `✅ ${result.pdfs} neue Rechnung(en) per E-Mail empfangen`
      : 'Keine neuen E-Mails mit PDF-Anhängen'
    
    console.log(`[Email Inbox Cron] ${message}`)
    
    return NextResponse.json({
      ok: true,
      message,
      processed: result.processed,
      pdfs: result.pdfs,
      errors: result.errors,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Email Inbox Cron] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
