export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'
import { sendEmail } from '@/lib/email-client'
import { SCORE_CONFIG } from '@/lib/score-coldleads-config'

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
    
    const db = await connectToMongoDB()
    const prospectsCollection = db.collection('prospects')
    
    // Lade Prospect
    const prospect = await prospectsCollection.findOne({ id: prospect_id })
    
    if (!prospect) {
      return NextResponse.json({
        ok: false,
        error: 'Prospect not found'
      }, { status: 404 })
    }
    
    if (!prospect.email_sequence) {
      return NextResponse.json({
        ok: false,
        error: 'No email sequence generated. Please analyze first.'
      }, { status: 400 })
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
    
    // Versende Email
    await sendEmail({
      from: `"${SCORE_CONFIG.sender.display_name}" <${SCORE_CONFIG.sender.email}>`,
      to: recipientEmail,
      bcc: SCORE_CONFIG.company.email_main, // BCC an Leismann
      subject: mailData.subject,
      text: mailData.body
    })
    
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
    
    await prospectsCollection.updateOne(
      { id: prospect_id },
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
