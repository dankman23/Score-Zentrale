export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../../lib/mongodb'
import { sendEmail } from '../../../../lib/email-client'
import { SCORE_CONFIG } from '../../../../lib/score-coldleads-config'

/**
 * GET /api/coldleads/followup/auto
 * Prüft und versendet fällige Follow-up Mails automatisch
 */
export async function GET() {
  try {
    const db = await connectToMongoDB()
    const prospectsCollection = db.collection('prospects')
    const now = new Date()
    
    let sentCount = 0
    let errorCount = 0
    
    // Finde Prospects mit fälligen Follow-ups
    
    // Mail 2 fällig
    const mail2Due = await prospectsCollection.find({
      'followup_schedule.mail_2_scheduled': { $lte: now },
      'followup_schedule.mail_2_sent': false,
      status: 'contacted'
    }).toArray()
    
    for (const prospect of mail2Due) {
      try {
        const recipientEmail = prospect.analysis_v3?.contact_person?.email
        if (!recipientEmail || !prospect.email_sequence?.mail_2) continue
        
        await sendEmail(recipientEmail, prospect.email_sequence.mail_2.subject, prospect.email_sequence.mail_2.body, prospect.email_sequence.mail_2.body)
        
        // Schedule Mail 3
        const mail3Date = new Date(prospect.followup_schedule.mail_1_sent_at)
        mail3Date.setDate(mail3Date.getDate() + SCORE_CONFIG.followup_schedule.followup_2_days)
        
        await prospectsCollection.updateOne(
          { id: prospect.id },
          {
            $set: {
              'followup_schedule.mail_2_sent': true,
              'followup_schedule.mail_2_sent_at': now,
              'followup_schedule.mail_3_scheduled': mail3Date,
              updated_at: now
            }
          }
        )
        
        sentCount++
        console.log(`[AutoFollowup] Mail 2 sent to ${prospect.company_name}`)
        
      } catch (e) {
        console.error(`[AutoFollowup] Error sending Mail 2 to ${prospect.company_name}:`, e)
        errorCount++
      }
    }
    
    // Mail 3 fällig
    const mail3Due = await prospectsCollection.find({
      'followup_schedule.mail_3_scheduled': { $lte: now },
      'followup_schedule.mail_3_sent': false,
      status: 'contacted'
    }).toArray()
    
    for (const prospect of mail3Due) {
      try {
        const recipientEmail = prospect.analysis_v3?.contact_person?.email
        if (!recipientEmail || !prospect.email_sequence?.mail_3) continue
        
        await sendEmail(recipientEmail, prospect.email_sequence.mail_3.subject, prospect.email_sequence.mail_3.body, prospect.email_sequence.mail_3.body)
        
        await prospectsCollection.updateOne(
          { id: prospect.id },
          {
            $set: {
              'followup_schedule.mail_3_sent': true,
              'followup_schedule.mail_3_sent_at': now,
              'followup_schedule.sequence_complete': true,
              updated_at: now
            }
          }
        )
        
        sentCount++
        console.log(`[AutoFollowup] Mail 3 sent to ${prospect.company_name}`)
        
      } catch (e) {
        console.error(`[AutoFollowup] Error sending Mail 3 to ${prospect.company_name}:`, e)
        errorCount++
      }
    }
    
    return NextResponse.json({
      ok: true,
      sent: sentCount,
      errors: errorCount,
      timestamp: now.toISOString()
    })
    
  } catch (error: any) {
    console.error('[AutoFollowup] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Auto-followup failed'
    }, { status: 500 })
  }
}
