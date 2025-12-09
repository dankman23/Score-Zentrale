export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/../lib/mongodb'

/**
 * POST /api/coldleads/followup/check
 * Prüft welche Prospects ein Follow-up benötigen
 * Sendet Follow-up Emails
 */
export async function POST() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('prospects')
    
    // Berechne Datum vor 6 Tagen
    const sixDaysAgo = new Date()
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
    
    console.log(`[Follow-up] Checking for prospects contacted before ${sixDaysAgo.toISOString()}`)
    
    // Finde Prospects die:
    // - Status contacted haben
    // - Email vor 6+ Tagen versendet
    // - Noch nicht replied
    // - Weniger als 2 Follow-ups bereits erhalten
    const needsFollowup = await collection.find({
      status: 'contacted',
      email_sent_at: { $lte: sixDaysAgo },
      hasReply: { $ne: true },
      $expr: {
        $lt: [
          { 
            $size: { 
              $filter: {
                input: '$history',
                as: 'h',
                cond: { $eq: ['$$h.type', 'followup_sent'] }
              }
            }
          },
          2 // Weniger als 2 Follow-ups
        ]
      }
    }).toArray()
    
    console.log(`[Follow-up] Found ${needsFollowup.length} prospects needing follow-up`)
    
    if (needsFollowup.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        message: 'Keine Follow-ups benötigt'
      })
    }
    
    const results = []
    
    // Sende Follow-up für jeden
    for (const prospect of needsFollowup) {
      try {
        console.log(`[Follow-up] Sending to ${prospect.company_name}`)
        
        const contactPerson = prospect.analysis?.contact_persons?.[0]
        if (!contactPerson?.email) {
          console.log(`[Follow-up] No email for ${prospect.company_name}, skipping`)
          continue
        }
        
        // Generiere Follow-up Email
        const followupEmail = generateFollowupEmail(prospect)
        
        // Sende Email (nutze SMTP Client)
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/coldleads/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: prospect.website,
            send: true,
            isFollowup: true
          })
        })
        
        const result = await response.json()
        
        if (result.ok) {
          // Update History
          await collection.updateOne(
            { _id: prospect._id },
            {
              $set: { updated_at: new Date() },
              $push: {
                history: {
                  type: 'followup_sent',
                  date: new Date(),
                  to: contactPerson.email,
                  subject: followupEmail.subject,
                  body: followupEmail.body.substring(0, 500)
                }
              }
            } as any
          )
          
          results.push({
            company_name: prospect.company_name,
            success: true
          })
          
          console.log(`[Follow-up] ✅ Sent to ${prospect.company_name}`)
        } else {
          results.push({
            company_name: prospect.company_name,
            success: false,
            error: result.error
          })
          console.error(`[Follow-up] ❌ Failed for ${prospect.company_name}:`, result.error)
        }
        
        // Rate Limiting: Warte 1 Minute zwischen Follow-ups
        await new Promise(resolve => setTimeout(resolve, 60000))
        
      } catch (error: any) {
        console.error(`[Follow-up] Error for ${prospect.company_name}:`, error)
        results.push({
          company_name: prospect.company_name,
          success: false,
          error: error.message
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({
      ok: true,
      count: needsFollowup.length,
      sent: successCount,
      failed: results.length - successCount,
      results
    })
    
  } catch (error: any) {
    console.error('[Follow-up Check] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}

/**
 * Generiert kurze, friendly Follow-up Email
 */
function generateFollowupEmail(prospect: any) {
  const contactPerson = prospect.analysis?.contact_persons?.[0]
  const greeting = contactPerson?.department === 'Einkauf' 
    ? `Sehr geehrte Damen und Herren der Einkaufsabteilung`
    : `Sehr geehrte Damen und Herren`
  
  const subject = `Nachfrage: Schleifwerkzeuge für ${prospect.company_name}`
  
  const body = `${greeting},

vor einigen Tagen hatte ich Ihnen unser Schleifwerkzeug-Sortiment vorgestellt.

Ich wollte kurz nachfragen, ob Sie Interesse an einem unverbindlichen Vergleichsangebot haben oder ob ich Ihnen bei Fragen weiterhelfen kann.

Gerne können wir auch telefonisch über Ihre spezifischen Anforderungen sprechen.

Sie erreichen mich unter:
📞 0221-25999901
📧 leismann@score-schleifwerkzeuge.de

Ich freue mich auf Ihre Rückmeldung!

Mit freundlichen Grüßen

Daniel Leismann
Vertrieb & Kundenberatung
Score Schleifwerkzeuge
www.score-schleifwerkzeuge.de`

  return { subject, body }
}
