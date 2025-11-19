export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../lib/api'
import { sendEmail } from '../../../../services/coldleads/emailer'

/**
 * GET /api/coldleads/followup
 * Checks for prospects that need follow-up (6 business days after last contact)
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')

    // Calculate 6 business days ago
    const now = new Date()
    const sixWorkdaysAgo = new Date(now)
    let daysToSubtract = 0
    let workdaysCount = 0
    
    while (workdaysCount < 6) {
      daysToSubtract++
      const checkDate = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000)
      const dayOfWeek = checkDate.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workdaysCount++
      }
    }
    sixWorkdaysAgo.setDate(now.getDate() - daysToSubtract)

    // Find prospects that:
    // 1. Were contacted (status = 'contacted')
    // 2. Last contact was 6+ business days ago
    // 3. Haven't replied (hasReply != true)
    // 4. Haven't received max follow-ups (followup_count < 2)
    const prospects = await collection.find({
      status: 'contacted',
      last_contact_date: { $lte: sixWorkdaysAgo },
      hasReply: { $ne: true },
      $or: [
        { followup_count: { $exists: false } },
        { followup_count: { $lt: 2 } }
      ]
    }).toArray()

    const results = []
    for (const prospect of prospects) {
      const followupCount = prospect.followup_count || 0
      
      // Generate follow-up email
      const subject = `Nachfrage: ${prospect.analysis?.needs_assessment?.potential_products?.[0] || 'Schleifwerkzeuge'} für ${prospect.company_name}`
      
      const body = `Guten Tag${prospect.analysis?.contact_persons?.[0]?.name ? ` ${prospect.analysis.contact_persons[0].name.split(' ')[0]}` : ''},

vor einigen Tagen habe ich Ihnen bezüglich unserer Schleifwerkzeuge für ${prospect.company_name} geschrieben.

Da ich noch keine Rückmeldung erhalten habe, möchte ich kurz nachfragen: Haben Sie Interesse an einem unverbindlichen Gespräch über Ihre aktuellen Anforderungen?

Wir bei Score Schleifwerkzeuge bieten:
• Hochwertige Schleifwerkzeuge für Ihre Branche
• Persönliche Beratung durch Experten
• Wettbewerbsfähige Preise und schnelle Lieferung

Falls Sie Fragen haben oder einen Termin vereinbaren möchten, erreichen Sie mich gerne unter:
📞 0221-25999901
📧 berres@score-schleifwerkzeuge.de

Ich freue mich auf Ihre Rückmeldung.

Mit freundlichen Grüßen

Christian Berres
Score Handels GmbH & Co. KG
Ohmstraße 5, 51143 Köln
berres@score-schleifwerkzeuge.de
www.score-schleifwerkzeuge.de`

      const contactEmail = prospect.analysis?.contact_persons?.[0]?.email
      
      if (contactEmail) {
        try {
          const result = await sendEmail(contactEmail, subject, body)
          
          // Update prospect
          await collection.updateOne(
            { _id: prospect._id },
            {
              $set: {
                last_contact_date: new Date(),
                followup_count: followupCount + 1,
                updated_at: new Date()
              },
              $push: {
                history: {
                  type: 'followup_sent',
                  date: new Date(),
                  to: contactEmail,
                  subject,
                  body: body.substring(0, 500),
                  followupNumber: followupCount + 1,
                  messageId: result.messageId
                }
              }
            }
          )

          results.push({
            company: prospect.company_name,
            email: contactEmail,
            followupNumber: followupCount + 1,
            sent: true
          })
        } catch (error: any) {
          results.push({
            company: prospect.company_name,
            email: contactEmail,
            followupNumber: followupCount + 1,
            sent: false,
            error: error.message
          })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: prospects.length,
      sent: results.filter(r => r.sent).length,
      failed: results.filter(r => !r.sent).length,
      results
    })
  } catch (error: any) {
    console.error('[FollowUp] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
