export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'

/**
 * GET /api/coldleads/postausgang
 * Zeigt alle gesendeten Mails (wie ein Email-Client Postausgang)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    
    const db = await connectToMongoDB()
    const prospects = db.collection('prospects')
    
    // Hole alle Prospects die mindestens 1 Mail gesendet haben
    const sentEmails = await prospects.find({
      'followup_schedule.mail_1_sent': true
    })
    .sort({ 'followup_schedule.mail_1_sent_at': -1 })
    .limit(limit)
    .toArray()
    
    // Baue Email-Liste auf
    const emails: any[] = []
    
    for (const p of sentEmails) {
      const schedule = p.followup_schedule || {}
      const recipientEmail = p.analysis_v3?.contact_person?.email || 'Unbekannt'
      
      // Mail 1
      if (schedule.mail_1_sent_at) {
        emails.push({
          id: `${p.id || p._id}-mail1`,
          prospect_id: p.id || p._id.toString(),
          company_name: p.company_name,
          recipient: recipientEmail,
          subject: p.email_sequence?.mail_1?.subject || 'Erstansprache',
          body: p.email_sequence?.mail_1?.body || '',
          sent_at: schedule.mail_1_sent_at,
          mail_type: 'Erstansprache',
          mail_number: 1
        })
      }
      
      // Mail 2 (Follow-up 1)
      if (schedule.mail_2_sent_at) {
        emails.push({
          id: `${p.id || p._id}-mail2`,
          prospect_id: p.id || p._id.toString(),
          company_name: p.company_name,
          recipient: recipientEmail,
          subject: p.email_sequence?.mail_2?.subject || 'Follow-up 1',
          body: p.email_sequence?.mail_2?.body || '',
          sent_at: schedule.mail_2_sent_at,
          mail_type: 'Follow-up 1',
          mail_number: 2
        })
      }
      
      // Mail 3 (Follow-up 2)
      if (schedule.mail_3_sent_at) {
        emails.push({
          id: `${p.id || p._id}-mail3`,
          prospect_id: p.id || p._id.toString(),
          company_name: p.company_name,
          recipient: recipientEmail,
          subject: p.email_sequence?.mail_3?.subject || 'Follow-up 2',
          body: p.email_sequence?.mail_3?.body || '',
          sent_at: schedule.mail_3_sent_at,
          mail_type: 'Follow-up 2',
          mail_number: 3
        })
      }
    }
    
    // Sortiere alle Mails nach Datum (neueste zuerst)
    emails.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    
    return NextResponse.json({
      ok: true,
      total: emails.length,
      from_email: 'daniel@score-schleifwerkzeuge.de',
      bcc: ['leismann@score-schleifwerkzeuge.de', 'danki.leismann@gmx.de'],
      emails: emails.slice(0, limit)
    })
    
  } catch (error: any) {
    console.error('[Postausgang] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
