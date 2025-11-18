/**
 * API: E-Mail Generator & Versand für Kaltakquise
 * Generiert personalisierte E-Mails basierend auf Firmen-Analyse
 * Optional: Versendet E-Mails direkt per SMTP
 */

import { NextRequest, NextResponse } from 'next/server'
import { generatePersonalizedEmail } from '@/services/coldleads/email-generator'
import { sendEmail } from '@/services/coldleads/emailer'
import { connectToDb } from '@/lib/db/mongodb'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { prospectId, kontaktpersonIndex, sendNow } = await req.json()
    
    if (!prospectId) {
      return NextResponse.json(
        { error: 'prospectId erforderlich' },
        { status: 400 }
      )
    }
    
    console.log(`[Email Generator] Start für Prospect: ${prospectId}`)
    
    // Lade Prospect aus DB
    const db = await connectToDb()
    const collection = db.collection('coldleads_prospects')
    
    const prospect = await collection.findOne({ _id: prospectId })
    
    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect nicht gefunden' },
        { status: 404 }
      )
    }
    
    if (!prospect.analysis) {
      return NextResponse.json(
        { error: 'Keine Analyse verfügbar - bitte zuerst analysieren' },
        { status: 400 }
      )
    }
    
    // Wähle Kontaktperson
    let kontaktperson = null
    if (kontaktpersonIndex !== undefined && prospect.analysis.kontaktpersonen[kontaktpersonIndex]) {
      kontaktperson = prospect.analysis.kontaktpersonen[kontaktpersonIndex]
    }
    
    // Generiere E-Mail
    const email = await generatePersonalizedEmail(prospect.analysis, kontaktperson)
    
    console.log(`[Email Generator] E-Mail generiert: ${email.betreff}`)
    
    // Speichere E-Mail in Prospect
    await collection.updateOne(
      { _id: prospectId },
      {
        $set: {
          email_generated: true,
          email_generated_at: new Date(),
          email_draft: email,
          email_recipient: kontaktperson?.email || null
        }
      }
    )
    
    return NextResponse.json({
      success: true,
      email
    })
    
  } catch (error: any) {
    console.error('[Email Generator] Error:', error)
    return NextResponse.json(
      { error: error.message || 'E-Mail-Generierung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
