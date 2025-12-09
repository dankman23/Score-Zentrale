export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '../../../lib/api'
import { sendEmail } from '@/lib/email-client'
import { SCORE_CONFIG } from '@/lib/score-coldleads-config'
import { buildProspectQuery } from '@/lib/prospect-utils'

/**
 * POST /api/coldleads/email-v3/send
 * Versendet Mail 1 (Erstansprache) und schedulet Follow-ups
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prospect_id, mail_number = 1 } = body
    
    if (!prospect_id) {
      return NextResponse.json({
        ok: false,
        error: 'prospect_id required'
      }, { status: 400 })
    }
    
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    
    // Lade Prospect mit vereinheitlichter Query-Logik
    console.log(`[EmailV3] Looking for prospect with ID: ${prospect_id}, type: ${typeof prospect_id}`)
    
    const query = buildProspectQuery(prospect_id)
    const prospect = await prospectsCollection.findOne(query)
    
    if (!prospect) {
      console.error(`[EmailV3] Prospect not found! Tried id=${prospect_id} and _id=${prospect_id}`)
      
      // Debug: Zeige die ersten IDs in der DB
      const sample = await prospectsCollection.findOne({})
      console.log(`[EmailV3] Sample prospect ID: ${sample?.id || sample?._id}, type: ${typeof (sample?.id || sample?._id)}`)
      
      return NextResponse.json({
        ok: false,
        error: 'Prospect not found'
      }, { status: 404 })
    }
    
    // Prüfe ob analysis_v3 vorhanden ist
    if (!prospect.analysis_v3) {
      return NextResponse.json({
        ok: false,
        error: 'Prospect not analyzed yet. Missing analysis_v3.'
      }, { status: 400 })
    }
    
    // Generiere email_sequence on-the-fly wenn fehlt
    if (!prospect.email_sequence) {
      console.log('[EmailV3] Generating email_sequence on-the-fly...')
      
      const { generateEmailSequenceV3FromAnalysis } = await import('../../../../../services/coldleads/emailer-v3')
      const emailSequence = await generateEmailSequenceV3FromAnalysis(prospect.analysis_v3, prospect.company_name)
      
      // Speichere email_sequence in DB
      await prospectsCollection.updateOne(
        query,
        { $set: { email_sequence: emailSequence } }
      )
      
      prospect.email_sequence = emailSequence
      console.log('[EmailV3] Email sequence generated and saved')
    }
    
    // Wähle richtige Mail
    let mailData
    let recipientEmail
    
    if (mail_number === 1) {
      mailData = prospect.email_sequence.mail_1
      recipientEmail = prospect.analysis_v3?.contact_person?.email || null
    } else if (mail_number === 2) {
      mailData = prospect.email_sequence.mail_2
      recipientEmail = prospect.analysis_v3?.contact_person?.email || null
    } else if (mail_number === 3) {
      mailData = prospect.email_sequence.mail_3
      recipientEmail = prospect.analysis_v3?.contact_person?.email || null
    } else {
      return NextResponse.json({
        ok: false,
        error: 'Invalid mail_number. Must be 1, 2, or 3.'
      }, { status: 400 })
    }
    
    if (!recipientEmail) {
      return NextResponse.json({
        ok: false,
        error: 'No recipient email found'
      }, { status: 400 })
    }
    
    // Versende Email (sendEmail erwartet: to, subject, htmlBody, textBody)
    // Stelle sicher dass subject ein String ist
    const subject = typeof mailData.subject === 'string' ? mailData.subject : String(mailData.subject || 'Schleifwerkzeuge Angebot')
    
    console.log(`[EmailV3] Sending email with subject: "${subject}"`)
    
    await sendEmail(recipientEmail, subject, mailData.body, mailData.body)
    
    console.log(`[EmailV3] Mail ${mail_number} sent to ${recipientEmail}`)
    
    const now = new Date()
    
    // Update Prospect
    const updates: any = {
      updated_at: now
    }
    
    if (mail_number === 1) {
      updates.status = 'contacted'
      updates['followup_schedule.mail_1_sent'] = true
      updates['followup_schedule.mail_1_sent_at'] = now
      
      // Schedule Mail 2 in 5 days
      const mail2Date = new Date(now)
      mail2Date.setDate(mail2Date.getDate() + SCORE_CONFIG.followup_schedule.followup_1_days)
      updates['followup_schedule.mail_2_scheduled'] = mail2Date
      
    } else if (mail_number === 2) {
      updates['followup_schedule.mail_2_sent'] = true
      updates['followup_schedule.mail_2_sent_at'] = now
      
      // Schedule Mail 3 in 12 days from original
      const mail3Date = new Date(prospect.followup_schedule.mail_1_sent_at)
      mail3Date.setDate(mail3Date.getDate() + SCORE_CONFIG.followup_schedule.followup_2_days)
      updates['followup_schedule.mail_3_scheduled'] = mail3Date
      
    } else if (mail_number === 3) {
      updates['followup_schedule.mail_3_sent'] = true
      updates['followup_schedule.mail_3_sent_at'] = now
      updates['followup_schedule.sequence_complete'] = true
    }
    
    // CRITICAL FIX: Use same query logic as when loading the prospect
    await prospectsCollection.updateOne(
      query,  // Verwendet dieselbe $or-Query (id oder _id)
      { $set: updates }
    )
    
    return NextResponse.json({
      ok: true,
      message: `Mail ${mail_number} sent successfully`,
      recipient: recipientEmail,
      subject: mailData.subject
    })
    
  } catch (error: any) {
    console.error('[EmailV3] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Email send failed'
    }, { status: 500 })
  }
}
